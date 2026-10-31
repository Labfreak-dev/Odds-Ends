// Lake sheet. Two OpenGL normal copies, fresnel, and a tight specular.
// Tile sizes and scroll speeds come from the CC0 kit notes.
Shader "Hollowmere/Water"
{
    Properties
    {
        [MainColor] _BaseColor ("Color", Color) = (0.05, 0.16, 0.18, 1)
        _BumpMap ("Normal", 2D) = "bump" {}
        _TileA ("Tile A metres", Float) = 6
        _TileB ("Tile B metres", Float) = 3.7
        _NormalScale ("Normal", Range(0,1)) = 0.4
        _Smoothness ("Smoothness", Range(0,1)) = 0.95
    }
    SubShader
    {
        Tags { "RenderType" = "Transparent" "Queue" = "Transparent" "RenderPipeline" = "UniversalPipeline" }
        Pass
        {
            Name "Forward"
            Tags { "LightMode" = "UniversalForward" }
            Blend SrcAlpha OneMinusSrcAlpha
            ZWrite Off
            Cull Off

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

            TEXTURE2D(_BumpMap); SAMPLER(sampler_BumpMap);

            CBUFFER_START(UnityPerMaterial)
                half4 _BaseColor;
                half _TileA;
                half _TileB;
                half _NormalScale;
                half _Smoothness;
            CBUFFER_END

            struct Attributes
            {
                float4 positionOS : POSITION;
                float3 normalOS : NORMAL;
            };
            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float3 positionWS : TEXCOORD0;
                float3 normalWS : TEXCOORD1;
            };

            Varyings vert(Attributes v)
            {
                Varyings o;
                o.positionCS = TransformObjectToHClip(v.positionOS.xyz);
                o.positionWS = TransformObjectToWorld(v.positionOS.xyz);
                o.normalWS = TransformObjectToWorldNormal(v.normalOS);
                return o;
            }

            half4 frag(Varyings i) : SV_Target
            {
                float2 a = i.positionWS.xz / max(_TileA, 0.5) + _Time.y * float2(0.02, 0.01);
                float2 b = i.positionWS.xz / max(_TileB, 0.5) + _Time.y * float2(-0.015, 0.025);
                half3 na = UnpackNormal(SAMPLE_TEXTURE2D(_BumpMap, sampler_BumpMap, a));
                half3 nb = UnpackNormal(SAMPLE_TEXTURE2D(_BumpMap, sampler_BumpMap, b));
                half3 n = normalize(i.normalWS + float3(na.x + nb.x, 0, na.y + nb.y) * _NormalScale);
                Light sun = GetMainLight();
                half3 view = normalize(GetCameraPositionWS() - i.positionWS);
                half fres = pow(1.0 - saturate(dot(n, view)), 4.0);
                half3 hv = normalize(sun.direction + view);
                half spec = pow(saturate(dot(n, hv)), exp2(10.0 * _Smoothness)) * _Smoothness;
                half3 deep = _BaseColor.rgb;
                half3 rgb = lerp(deep, deep + half3(0.15, 0.35, 0.38), fres) + sun.color * spec * 0.85;
                half alpha = saturate(0.72 + fres * 0.28);
                return half4(rgb, alpha);
            }
            ENDHLSL
        }
    }
    FallBack Off
}
