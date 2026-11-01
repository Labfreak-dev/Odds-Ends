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
        _Desat ("Desaturate", Range(0,1)) = 0
        _Finish ("Finish", Range(0,1)) = 0
        _RimPower ("Rim Power", Float) = 4
        _EdgeBoost ("Edge", Float) = 0
        _RimOnly ("Rim Only", Float) = 0
        _KillEmit ("Kill Emit", Float) = 0
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
                half _Desat;
                half _Finish;
                half _RimPower;
                half _EdgeBoost;
                half _RimOnly;
                half _KillEmit;
            CBUFFER_END

            // Hero face sphere. Set from the head bone. Zero radius disables the cut.
            float4 _HmFaceCenter;
            float _HmFaceRadius;

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
                float3 normalOS : TEXCOORD5;
                float3 positionOS : TEXCOORD6;
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
                o.normalOS = v.normalOS;
                o.positionOS = v.positionOS.xyz;
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
                // Desaturate the sampled map. A flat colour multiply would erase it.
                half luma = dot(albedo, half3(0.299, 0.587, 0.114));
                albedo = lerp(albedo, luma.xxx, saturate(_Desat));

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
                // Pull toward the rarity scalars. The map's variation stays in the leftover weight.
                metallic = lerp(metallic, _Metallic, saturate(_Finish));
                smoothness = lerp(smoothness, _Smoothness, saturate(_Finish));
                half3 specCol = lerp(half3(0.04, 0.04, 0.04), albedo, metallic);
                albedo *= 1.0 - metallic;

                Light mainLight = GetMainLight();
                half ndotl = saturate(dot(n, mainLight.direction));
                half3 halfVec = normalize(mainLight.direction + view);
                half spec = pow(saturate(dot(n, halfVec)), exp2(10.0 * smoothness)) * smoothness;
                half3 lit = albedo * (SampleSH(n) + mainLight.color * ndotl) + specCol * mainLight.color * spec;
                // Polished metal has almost no diffuse. Reflect the probe so it does not go black.
                half3 env = GlossyEnvironmentReflection(reflect(-view, n), saturate(1.0 - smoothness), 1.0);
                env = max(env, half3(0.16, 0.17, 0.19));
                lit += specCol * env * (0.25 + smoothness);

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

                // Rare uses a view fresnel. Legendary and set use an object-space crease and a UV seam,
                // not the screen-space outline, so the glow cannot streak across the face.
                half ndv = saturate(dot(n, view));
                half fres = pow(1.0 - ndv, max(_RimPower, 0.5));
                float span = max(length(fwidth(i.positionOS)), 1e-4);
                half crease = length(fwidth(i.normalOS)) / span;
                half seam = length(fwidth(i.uv)) / span;
                half edge = saturate(max(crease - 14.0, seam * 0.35 - 6.0) * _EdgeBoost * 0.04);
                half legacy = 0.35 + pow(1.0 - ndv, 3.0);
                half mask = 0.0;
                if (_KillEmit < 0.5)
                    mask = _RimOnly > 0.5 ? (_EdgeBoost > 0.01 ? edge : fres) : legacy;
                float face = 1.0;
                // Dark past the checked face sphere, so the collar cannot light the disc.
                if (mask > 0.0 && _HmFaceRadius > 0.001)
                    face = saturate((distance(i.positionWS, _HmFaceCenter.xyz) - (_HmFaceRadius + 0.06)) * 25.0);
                lit += _EmissionColor.rgb * mask * face;
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
