// Procedural floors, walls and props. Referenced by Resources/HollowmereColor.mat so the
// player build keeps this shader. Do not Shader.Find it: a stripped lookup is what turned
// the Galaxy build into a magenta void.
Shader "Hollowmere/Color"
{
    Properties
    {
        [MainColor] _BaseColor ("Color", Color) = (1,1,1,1)
        _Color ("Color", Color) = (1,1,1,1)
        _BaseMap ("Albedo", 2D) = "white" {}
        _HasMap ("Has Map", Float) = 0
        _EmissionColor ("Emission", Color) = (0,0,0,1)
        _Smoothness ("Smoothness", Range(0,1)) = 0.15
    }
    SubShader
    {
        Tags
        {
            "RenderType" = "Opaque"
            "Queue" = "Geometry"
            "RenderPipeline" = "UniversalPipeline"
        }
        Pass
        {
            Name "Forward"
            Tags { "LightMode" = "UniversalForward" }
            Cull Back
            ZWrite On

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

            TEXTURE2D(_BaseMap);
            SAMPLER(sampler_BaseMap);

            CBUFFER_START(UnityPerMaterial)
                half4 _BaseColor;
                half4 _Color;
                half4 _EmissionColor;
                half _Smoothness;
                half _HasMap;
            CBUFFER_END

            struct Attributes
            {
                float4 positionOS : POSITION;
                float3 normalOS : NORMAL;
                float2 uv : TEXCOORD0;
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float3 normalWS : TEXCOORD0;
                float2 uv : TEXCOORD1;
                float3 positionWS : TEXCOORD2;
            };

            Varyings vert(Attributes v)
            {
                Varyings o;
                o.positionCS = TransformObjectToHClip(v.positionOS.xyz);
                o.positionWS = TransformObjectToWorld(v.positionOS.xyz);
                o.normalWS = TransformObjectToWorldNormal(v.normalOS);
                o.uv = v.uv;
                return o;
            }

            half4 frag(Varyings i) : SV_Target
            {
                half3 n = normalize(i.normalWS);
                // Material.color writes _Color. Art.Mat also writes _BaseColor to the same value,
                // so use _BaseColor when it was set and fall back without multiplying the two.
                // _HasMap stays 0 on flat colors. Sampling an unset map would turn the floor black.
                half3 albedo = _BaseColor.rgb;
                if (_HasMap > 0.5) albedo *= SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, i.uv).rgb;
                Light mainLight = GetMainLight();
                half ndotl = saturate(dot(n, mainLight.direction));
                half3 ambient = SampleSH(n);
                half3 lit = albedo * (ambient + mainLight.color * ndotl) + _EmissionColor.rgb;
                // URP only fogs shaders that opt in, and the FOG_LINEAR keyword is never set on
                // this pass, so MixFog was a no-op. unity_FogParams.z is negative while linear
                // fog is enabled and zero when it is off.
                if (unity_FogParams.z < -0.0001)
                {
                    float dist = distance(i.positionWS, GetCameraPositionWS());
                    float fog = saturate(dist * unity_FogParams.z + unity_FogParams.w);
                    lit = lerp(unity_FogColor.rgb, lit, fog);
                }
                return half4(lit, 1);
            }
            ENDHLSL
        }
    }
    FallBack Off
}
