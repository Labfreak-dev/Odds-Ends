// Additive glow for spell cores, trails and impact sheets.
// The first subshader is URP. The second is a built-in additive pass so a missing
// URP variant cannot fall through to the opaque magenta error shader.
// Referenced by Resources/HollowmereGlow.mat and listed in Always Included Shaders.
Shader "Hollowmere/Glow"
{
    Properties
    {
        [MainColor] _BaseColor ("Color", Color) = (0.7, 0.35, 1, 1)
        _Color ("Color", Color) = (0.7, 0.35, 1, 1)
        _EmissionColor ("Emission", Color) = (0.7, 0.35, 1, 1)
        _MainTex ("Texture", 2D) = "white" {}
        _UseVertexColor ("Use Vertex Color", Float) = 0
        _HasMap ("Has Map", Float) = 0
        _Soft ("Soft Disc", Float) = 1
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
            Cull Off

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            TEXTURE2D(_MainTex);
            SAMPLER(sampler_MainTex);

            CBUFFER_START(UnityPerMaterial)
                half4 _BaseColor;
                half4 _Color;
                half4 _EmissionColor;
                float4 _MainTex_ST;
                half _UseVertexColor;
                half _HasMap;
                half _Soft;
            CBUFFER_END

            struct Attributes
            {
                float4 positionOS : POSITION;
                float2 uv : TEXCOORD0;
                half4 color : COLOR;
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float2 uv : TEXCOORD0;
                half4 color : COLOR;
            };

            Varyings vert(Attributes v)
            {
                Varyings o;
                o.positionCS = TransformObjectToHClip(v.positionOS.xyz);
                o.uv = v.uv;
                o.color = v.color;
                return o;
            }

            half4 frag(Varyings i) : SV_Target
            {
                half3 rgb = _BaseColor.rgb;
                if (_UseVertexColor > 0.5)
                    rgb *= i.color.rgb * i.color.a;
                if (_HasMap > 0.5)
                {
                    float2 uv = i.uv * _MainTex_ST.xy + _MainTex_ST.zw;
                    half4 tex = SAMPLE_TEXTURE2D(_MainTex, sampler_MainTex, uv);
                    half lum = dot(tex.rgb, half3(0.25, 0.55, 0.2));
                    half mask = tex.a * saturate(lum * 1.6);
                    rgb *= tex.rgb * mask;
                }
                else if (_Soft > 0.5)
                {
                    float2 p = i.uv * 2.0 - 1.0;
                    float disc = saturate(1.0 - dot(p, p));
                    disc *= disc;
                    rgb *= disc;
                }
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
            Cull Off
            Lighting Off
            Fog { Mode Off }

            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            sampler2D _MainTex;
            float4 _MainTex_ST;
            fixed4 _BaseColor;
            fixed _UseVertexColor;
            fixed _HasMap;
            fixed _Soft;

            struct appdata
            {
                float4 vertex : POSITION;
                float2 uv : TEXCOORD0;
                fixed4 color : COLOR;
            };

            struct v2f
            {
                float4 pos : SV_POSITION;
                float2 uv : TEXCOORD0;
                fixed4 color : COLOR;
            };

            v2f vert(appdata v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.uv = v.uv;
                o.color = v.color;
                return o;
            }

            fixed4 frag(v2f i) : SV_Target
            {
                fixed3 rgb = _BaseColor.rgb;
                if (_UseVertexColor > 0.5)
                    rgb *= i.color.rgb * i.color.a;
                if (_HasMap > 0.5)
                {
                    float2 uv = i.uv * _MainTex_ST.xy + _MainTex_ST.zw;
                    fixed4 tex = tex2D(_MainTex, uv);
                    fixed lum = dot(tex.rgb, fixed3(0.25, 0.55, 0.2));
                    fixed mask = tex.a * saturate(lum * 1.6);
                    rgb *= tex.rgb * mask;
                }
                else if (_Soft > 0.5)
                {
                    float2 p = i.uv * 2.0 - 1.0;
                    float disc = saturate(1.0 - dot(p, p));
                    disc *= disc;
                    rgb *= disc;
                }
                return fixed4(rgb, 1);
            }
            ENDCG
        }
    }
    FallBack Off
}
