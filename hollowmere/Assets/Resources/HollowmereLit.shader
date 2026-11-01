// URP lighting for imported characters. Hollowmere/Color is diffuse-only and
// back-face culled, which shreds capes and leaves the hero dark. This pass
// samples the imported base colour, normal, and metal/roughness maps and can
// draw both sides. It is pinned in the build. Universal Render Pipeline/Lit is
// used when that shader is present; this is the included fallback so a player
// build does not have to compile every Lit variant.
Shader "Hollowmere/Lit"
{
    Properties
    {
        [MainColor] _BaseColor ("Color", Color) = (1,1,1,1)
        _Color ("Color", Color) = (1,1,1,1)
        _BaseMap ("Albedo", 2D) = "white" {}
        _BumpMap ("Normal", 2D) = "bump" {}
        _MetallicGlossMap ("Metal", 2D) = "white" {}
        _HasMap ("Has Map", Float) = 0
        _HasNormal ("Has Normal", Float) = 0
        _HasMetal ("Has Metal", Float) = 0
        _GltfPack ("glTF metal/rough", Float) = 0
        _Metallic ("Metallic", Range(0,1)) = 0
        _Smoothness ("Smoothness", Range(0,1)) = 0.35
        _EmissionColor ("Emission", Color) = (0,0,0,1)
        _TintMask ("Tint Mask", 2D) = "black" {}
        _HasTint ("Has Tint", Float) = 0
        _TintArmour ("Armour Tint", Color) = (1,1,1,1)
        _TintCloth ("Cloth Tint", Color) = (1,1,1,1)
        _TintHair ("Hair Tint", Color) = (1,1,1,1)
        _TintSkin ("Skin Tint", Color) = (1,1,1,1)
        [Enum(UnityEngine.Rendering.CullMode)] _Cull ("Cull", Float) = 2
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
            Cull [_Cull]
            ZWrite On

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile _ _ADDITIONAL_LIGHTS
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

            TEXTURE2D(_BaseMap);
            SAMPLER(sampler_BaseMap);
            TEXTURE2D(_BumpMap);
            SAMPLER(sampler_BumpMap);
            TEXTURE2D(_MetallicGlossMap);
            SAMPLER(sampler_MetallicGlossMap);
            TEXTURE2D(_TintMask);
            SAMPLER(sampler_TintMask);

            CBUFFER_START(UnityPerMaterial)
                half4 _BaseColor;
                half4 _Color;
                half4 _EmissionColor;
                half4 _TintArmour;
                half4 _TintCloth;
                half4 _TintHair;
                half4 _TintSkin;
                half _Smoothness;
                half _Metallic;
                half _HasMap;
                half _HasNormal;
                half _HasMetal;
                half _GltfPack;
                half _HasTint;
            CBUFFER_END

            struct Attributes
            {
                float4 positionOS : POSITION;
                float3 normalOS : NORMAL;
                float4 tangentOS : TANGENT;
                float2 uv : TEXCOORD0;
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float3 normalWS : TEXCOORD0;
                float3 tangentWS : TEXCOORD1;
                float3 positionWS : TEXCOORD2;
                float2 uv : TEXCOORD3;
                float tangentSign : TEXCOORD4;
            };

            Varyings vert(Attributes v)
            {
                Varyings o;
                o.positionCS = TransformObjectToHClip(v.positionOS.xyz);
                o.positionWS = TransformObjectToWorld(v.positionOS.xyz);
                o.normalWS = TransformObjectToWorldNormal(v.normalOS);
                o.tangentWS = TransformObjectToWorldDir(v.tangentOS.xyz);
                o.tangentSign = v.tangentOS.w;
                o.uv = v.uv;
                return o;
            }

            half4 frag(Varyings i) : SV_Target
            {
                half3 albedo = _BaseColor.rgb;
                if (_HasMap > 0.5)
                    albedo *= SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, i.uv).rgb;
                // R armour, G cloth, B hair. Each multiplies the base colour. Skin is the uncovered rest.
                if (_HasTint > 0.5)
                {
                    half3 tex = albedo;
                    half3 mk = SAMPLE_TEXTURE2D(_TintMask, sampler_TintMask, i.uv).rgb;
                    half sum = mk.r + mk.g + mk.b;
                    half3 acc = tex * _TintArmour.rgb * mk.r + tex * _TintCloth.rgb * mk.g + tex * _TintHair.rgb * mk.b;
                    if (sum > 1.0) acc /= sum;
                    half remain = saturate(1.0 - min(sum, 1.0));
                    albedo = acc + tex * _TintSkin.rgb * remain;
                }

                half3 n = normalize(i.normalWS);
                half3 view = normalize(GetCameraPositionWS() - i.positionWS);
                if (dot(n, view) < 0)
                    n = -n;
                if (_HasNormal > 0.5 && dot(i.tangentWS, i.tangentWS) > 0.25)
                {
                    half3 tn = UnpackNormal(SAMPLE_TEXTURE2D(_BumpMap, sampler_BumpMap, i.uv));
                    half3 t = normalize(i.tangentWS);
                    half3 b = cross(n, t) * i.tangentSign;
                    n = normalize(t * tn.x + b * tn.y + n * tn.z);
                }

                half metallic = _Metallic;
                half smoothness = _Smoothness;
                if (_HasMetal > 0.5)
                {
                    half4 mr = SAMPLE_TEXTURE2D(_MetallicGlossMap, sampler_MetallicGlossMap, i.uv);
                    if (_GltfPack > 0.5)
                    {
                        metallic = mr.b;
                        smoothness = 1.0 - mr.g;
                    }
                    else
                    {
                        metallic = mr.r;
                        smoothness = mr.a;
                    }
                }
                half3 specCol = lerp(half3(0.04, 0.04, 0.04), albedo, metallic);
                albedo *= 1.0 - metallic;

                Light mainLight = GetMainLight();
                half ndotl = saturate(dot(n, mainLight.direction));
                half3 halfVec = normalize(mainLight.direction + view);
                half spec = pow(saturate(dot(n, halfVec)), exp2(10.0 * smoothness)) * smoothness;
                half3 lit = albedo * (SampleSH(n) + mainLight.color * ndotl) + specCol * mainLight.color * spec;

                #if defined(_ADDITIONAL_LIGHTS)
                uint count = GetAdditionalLightsCount();
                for (uint li = 0u; li < count; li++)
                {
                    Light add = GetAdditionalLight(li, i.positionWS);
                    half nd = saturate(dot(n, add.direction));
                    half3 hv = normalize(add.direction + view);
                    half sp = pow(saturate(dot(n, hv)), exp2(10.0 * smoothness)) * smoothness;
                    half atten = add.distanceAttenuation;
                    lit += albedo * add.color * atten * nd + specCol * add.color * atten * sp;
                }
                #endif

                // Rarity rim. Emission black on common and magic, so those stay matte.
                half rim = pow(saturate(1.0 - dot(n, view)), 3.0);
                lit += _EmissionColor.rgb * (0.35 + rim);
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
