// Equirectangular HDR sky. Town at night uses the moonlit map. Day uses the overcast map.
Shader "Hollowmere/Sky"
{
    Properties
    {
        _MainTex ("HDR", 2D) = "black" {}
        _Exposure ("Exposure", Float) = 1
    }
    SubShader
    {
        Tags
        {
            "Queue" = "Background"
            "RenderType" = "Background"
            "PreviewType" = "Skybox"
            "RenderPipeline" = "UniversalPipeline"
        }
        Cull Off
        ZWrite Off

        Pass
        {
            Name "Sky"
            Tags { "LightMode" = "UniversalForward" }

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            TEXTURE2D(_MainTex);
            SAMPLER(sampler_MainTex);
            float _Exposure;

            struct Attributes
            {
                float4 positionOS : POSITION;
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float3 dir : TEXCOORD0;
            };

            Varyings vert(Attributes v)
            {
                Varyings o;
                o.positionCS = TransformObjectToHClip(v.positionOS.xyz);
                o.dir = v.positionOS.xyz;
                return o;
            }

            half4 frag(Varyings i) : SV_Target
            {
                float3 d = normalize(i.dir);
                float u = atan2(d.x, d.z) * 0.15915494 + 0.5;
                float v = asin(clamp(d.y, -1.0, 1.0)) * 0.31830988 + 0.5;
                half3 col = SAMPLE_TEXTURE2D_LOD(_MainTex, sampler_MainTex, float2(u, v), 0).rgb;
                return half4(col * _Exposure, 1);
            }
            ENDHLSL
        }
    }
    FallBack Off
}
