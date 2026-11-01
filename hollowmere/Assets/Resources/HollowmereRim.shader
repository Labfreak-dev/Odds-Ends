// Additive fresnel rim. The facing surface stays empty so the albedo underneath
// keeps its texture. Only the grazing edge lights up.
Shader "Hollowmere/Rim"
{
    Properties
    {
        _RimColor ("Rim", Color) = (1, 0.45, 0.12, 1)
        _Color ("Color", Color) = (1, 0.45, 0.12, 1)
        _RimPower ("Power", Float) = 3.5
        _RimStrength ("Strength", Float) = 1.15
    }
    SubShader
    {
        Tags
        {
            "RenderType" = "Transparent"
            "Queue" = "Transparent"
            "RenderPipeline" = "UniversalPipeline"
            "IgnoreProjector" = "True"
        }
        Pass
        {
            Name "Forward"
            Tags { "LightMode" = "UniversalForward" }
            Blend One One
            ZWrite Off
            ZTest LEqual
            Cull Back

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            CBUFFER_START(UnityPerMaterial)
                half4 _RimColor;
                half4 _Color;
                half _RimPower;
                half _RimStrength;
            CBUFFER_END

            struct Attributes
            {
                float4 positionOS : POSITION;
                float3 normalOS : NORMAL;
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float3 normalWS : TEXCOORD0;
                float3 positionWS : TEXCOORD1;
            };

            Varyings vert(Attributes v)
            {
                Varyings o;
                o.positionWS = TransformObjectToWorld(v.positionOS.xyz);
                o.positionCS = TransformWorldToHClip(o.positionWS);
                o.normalWS = TransformObjectToWorldNormal(v.normalOS);
                return o;
            }

            half4 frag(Varyings i) : SV_Target
            {
                float3 n = normalize(i.normalWS);
                float3 v = normalize(_WorldSpaceCameraPos.xyz - i.positionWS);
                float ndv = saturate(dot(n, v));
                float fres = pow(1.0 - ndv, max(_RimPower, 0.5));
                clip(fres - 0.18);
                half3 rgb = _RimColor.rgb * fres * _RimStrength;
                return half4(rgb, 1);
            }
            ENDHLSL
        }
    }
    SubShader
    {
        Tags
        {
            "RenderType" = "Transparent"
            "Queue" = "Transparent"
            "IgnoreProjector" = "True"
        }
        Pass
        {
            Blend One One
            ZWrite Off
            ZTest LEqual
            Cull Back
            Lighting Off
            Fog { Mode Off }

            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            fixed4 _RimColor;
            float _RimPower;
            float _RimStrength;

            struct appdata
            {
                float4 vertex : POSITION;
                float3 normal : NORMAL;
            };

            struct v2f
            {
                float4 pos : SV_POSITION;
                float3 normalWS : TEXCOORD0;
                float3 positionWS : TEXCOORD1;
            };

            v2f vert(appdata v)
            {
                v2f o;
                o.positionWS = mul(unity_ObjectToWorld, v.vertex).xyz;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.normalWS = UnityObjectToWorldNormal(v.normal);
                return o;
            }

            fixed4 frag(v2f i) : SV_Target
            {
                float3 n = normalize(i.normalWS);
                float3 view = normalize(_WorldSpaceCameraPos.xyz - i.positionWS);
                float fres = pow(1.0 - saturate(dot(n, view)), max(_RimPower, 0.5));
                clip(fres - 0.18);
                return fixed4(_RimColor.rgb * fres * _RimStrength, 1);
            }
            ENDCG
        }
    }
}
