// World-space triplanar lit surface. _Tile is metres per repeat (the kit's tiling_m).
// Metallic map is URP style: R metallic, A smoothness. OpenGL normals, green is not flipped.
Shader "Hollowmere/Pbr"
{
    Properties
    {
        [MainColor] _BaseColor ("Color", Color) = (1,1,1,1)
        _BaseMap ("Albedo", 2D) = "white" {}
        _BumpMap ("Normal", 2D) = "bump" {}
        _MetallicGlossMap ("Metal", 2D) = "white" {}
        _OcclusionMap ("AO", 2D) = "white" {}
        _Tile ("Metres Per Tile", Float) = 2
        _HasNormal ("Has Normal", Float) = 0
        _HasMetal ("Has Metal", Float) = 0
        _HasAo ("Has AO", Float) = 0
        _Smoothness ("Smoothness", Range(0,1)) = 0.4
        _Metallic ("Metallic", Range(0,1)) = 0
    }
    SubShader
    {
        Tags { "RenderType" = "Opaque" "Queue" = "Geometry" "RenderPipeline" = "UniversalPipeline" }
        Pass
        {
            Name "Forward"
            Tags { "LightMode" = "UniversalForward" }
            Cull Back
            ZWrite On

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile _ _ADDITIONAL_LIGHTS
            #pragma multi_compile_fragment _ _SHADOWS_SOFT
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

            TEXTURE2D(_BaseMap); SAMPLER(sampler_BaseMap);
            TEXTURE2D(_BumpMap); SAMPLER(sampler_BumpMap);
            TEXTURE2D(_MetallicGlossMap); SAMPLER(sampler_MetallicGlossMap);
            TEXTURE2D(_OcclusionMap); SAMPLER(sampler_OcclusionMap);

            CBUFFER_START(UnityPerMaterial)
                half4 _BaseColor;
                half _Tile;
                half _HasNormal;
                half _HasMetal;
                half _HasAo;
                half _Smoothness;
                half _Metallic;
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

            half4 Tri(TEXTURE2D_PARAM(tex, samp), float3 p, float3 w)
            {
                half4 x = SAMPLE_TEXTURE2D(tex, samp, p.zy);
                half4 y = SAMPLE_TEXTURE2D(tex, samp, p.xz);
                half4 z = SAMPLE_TEXTURE2D(tex, samp, p.xy);
                return x * w.x + y * w.y + z * w.z;
            }

            half4 frag(Varyings i) : SV_Target
            {
                float3 n = normalize(i.normalWS);
                float3 w = abs(n);
                w = w * w; w *= w;
                w /= max(w.x + w.y + w.z, 1e-4);
                float tile = max(_Tile, 0.2);
                float3 p = i.positionWS / tile;

                half3 albedo = _BaseColor.rgb * Tri(TEXTURE2D_ARGS(_BaseMap, sampler_BaseMap), p, w).rgb;
                if (_HasAo > 0.5)
                    albedo *= Tri(TEXTURE2D_ARGS(_OcclusionMap, sampler_OcclusionMap), p, w).r;

                if (_HasNormal > 0.5)
                {
                    half3 nx = UnpackNormal(SAMPLE_TEXTURE2D(_BumpMap, sampler_BumpMap, p.zy));
                    half3 ny = UnpackNormal(SAMPLE_TEXTURE2D(_BumpMap, sampler_BumpMap, p.xz));
                    half3 nz = UnpackNormal(SAMPLE_TEXTURE2D(_BumpMap, sampler_BumpMap, p.xy));
                    float3 tn = nx * w.x + ny * w.y + nz * w.z;
                    n = normalize(n + float3(tn.x, tn.y, tn.z) * 0.65);
                }

                half metallic = _Metallic;
                half smoothness = _Smoothness;
                if (_HasMetal > 0.5)
                {
                    half4 mr = Tri(TEXTURE2D_ARGS(_MetallicGlossMap, sampler_MetallicGlossMap), p, w);
                    metallic = mr.r;
                    smoothness = mr.a;
                }
                half3 specCol = lerp(half3(0.04, 0.04, 0.04), albedo, metallic);
                albedo *= 1.0 - metallic;

                float4 shadowCoord = TransformWorldToShadowCoord(i.positionWS);
                Light mainLight = GetMainLight(shadowCoord);
                half ndotl = saturate(dot(n, mainLight.direction));
                half3 view = normalize(GetCameraPositionWS() - i.positionWS);
                half3 hv = normalize(mainLight.direction + view);
                half spec = pow(saturate(dot(n, hv)), exp2(10.0 * smoothness)) * smoothness;
                half shadow = mainLight.shadowAttenuation;
                half3 lit = albedo * (SampleSH(n) + mainLight.color * ndotl * shadow) + specCol * mainLight.color * spec * shadow;

                #if defined(_ADDITIONAL_LIGHTS)
                uint count = GetAdditionalLightsCount();
                for (uint li = 0u; li < count; li++)
                {
                    Light add = GetAdditionalLight(li, i.positionWS);
                    half nd = saturate(dot(n, add.direction));
                    lit += albedo * add.color * add.distanceAttenuation * nd;
                }
                #endif
                return half4(lit, 1);
            }
            ENDHLSL
        }
    }
    FallBack Off
}
