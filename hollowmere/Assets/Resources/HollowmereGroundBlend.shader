// Town ground: cobble paths blended into packed dirt and grass. No tile grid.
// Vertex colour R = path weight (bilinear across tile corners, so it never steps per tile).
// A world-space noise warps the edge and a height blend lets stones poke through dirt.
// Grass vs dirt comes from a large noise; grime, wet patches and cracks are noise "decals".
// Each layer is sampled twice at rotated scales to kill visible repetition.
Shader "Hollowmere/GroundBlend"
{
    Properties
    {
        _CobbleMap ("Cobble", 2D) = "white" {}
        _CobbleNormal ("Cobble N", 2D) = "bump" {}
        _CobbleAo ("Cobble AO/height", 2D) = "white" {}
        _DirtMap ("Dirt", 2D) = "white" {}
        _DirtNormal ("Dirt N", 2D) = "bump" {}
        _GrassMap ("Grass", 2D) = "white" {}
        _GrassNormal ("Grass N", 2D) = "bump" {}
        _CobbleTile ("Cobble metres", Float) = 2.2
        _DirtTile ("Dirt metres", Float) = 4.5
        _GrassTile ("Grass metres", Float) = 3.0
        _Tint ("Tint", Color) = (1,1,1,1)
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" "RenderPipeline"="UniversalPipeline" "Queue"="Geometry" }
        Pass
        {
            Name "Forward"
            Tags { "LightMode"="UniversalForward" }
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile _ _ADDITIONAL_LIGHTS
            #pragma multi_compile_fragment _ _SHADOWS_SOFT
            #pragma multi_compile_fog
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
            TEXTURE2D(_CobbleMap); SAMPLER(sampler_CobbleMap);
            TEXTURE2D(_CobbleNormal); TEXTURE2D(_CobbleAo);
            TEXTURE2D(_DirtMap); TEXTURE2D(_DirtNormal);
            TEXTURE2D(_GrassMap); TEXTURE2D(_GrassNormal);
            CBUFFER_START(UnityPerMaterial)
                float _CobbleTile; float _DirtTile; float _GrassTile; half4 _Tint;
            CBUFFER_END
            struct A { float4 p : POSITION; float3 n : NORMAL; half4 c : COLOR; };
            struct V { float4 p : SV_POSITION; float3 w : TEXCOORD0; half4 c : COLOR; float fog : TEXCOORD1; };
            V vert(A i)
            {
                V o; o.w = TransformObjectToWorld(i.p.xyz); o.p = TransformWorldToHClip(o.w); o.c = i.c;
                o.fog = ComputeFogFactor(o.p.z); return o;
            }
            float h21(float2 p) { p = frac(p * float2(123.34, 456.21)); p += dot(p, p + 45.32); return frac(p.x * p.y); }
            float vnoise(float2 p)
            {
                float2 i = floor(p), f = frac(p); f = f * f * (3 - 2 * f);
                return lerp(lerp(h21(i), h21(i + float2(1, 0)), f.x), lerp(h21(i + float2(0, 1)), h21(i + float2(1, 1)), f.x), f.y);
            }
            float fbm(float2 p) { float s = 0, a = 0.5; for (int k = 0; k < 4; k++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
            float2 rot(float2 p, float a) { float s = sin(a), c = cos(a); return float2(c * p.x - s * p.y, s * p.x + c * p.y); }
            half3 two(TEXTURE2D_PARAM(t, s), float2 uv, float m)
            {
                half3 a = SAMPLE_TEXTURE2D(t, s, uv).rgb;
                half3 b = SAMPLE_TEXTURE2D(t, s, rot(uv, 0.9) * 0.43 + 0.37).rgb;
                return lerp(a, b, m);
            }
            half3 nrm(TEXTURE2D_PARAM(t, s), float2 uv) { return UnpackNormal(SAMPLE_TEXTURE2D(t, s, uv)); }
            half4 frag(V i) : SV_Target
            {
                float2 xz = i.w.xz;
                float macro = fbm(xz * 0.11);
                float m2 = smoothstep(0.3, 0.7, fbm(xz * 0.07 + 5.0));
                float2 uvC = xz / _CobbleTile, uvD = xz / _DirtTile, uvG = xz / _GrassTile;
                half3 cob = two(TEXTURE2D_ARGS(_CobbleMap, sampler_CobbleMap), uvC, m2 * 0.5);
                half cobH = SAMPLE_TEXTURE2D(_CobbleAo, sampler_CobbleMap, uvC).r;
                half3 dirt = two(TEXTURE2D_ARGS(_DirtMap, sampler_CobbleMap), uvD, m2);
                half3 grass = two(TEXTURE2D_ARGS(_GrassMap, sampler_CobbleMap), uvG, m2);
                // Path mask: vertex weight, warped edge, height blend so whole stones stay or go.
                float edge = (fbm(xz * 0.55) - 0.5) * 0.55 + (vnoise(xz * 2.3) - 0.5) * 0.18;
                float path = saturate(i.c.r + edge);
                float pm = saturate((path - 0.5 + (cobH - 0.5) * 0.45) * 7.0);
                // Off-path: grass in big organic patches, dirt where feet wear it (near paths).
                float g = smoothstep(0.45, 0.62, macro + (1 - path) * 0.25 - 0.1);
                half3 offPath = lerp(dirt, grass * half3(0.62, 0.66, 0.50), g);
                // Path shoulder: dirt fringe a little wider than the stones.
                float fringe = saturate((path - 0.32) * 4.0) * (1 - pm);
                offPath = lerp(offPath, dirt * 0.92, fringe);
                half3 albedo = lerp(offPath, cob, pm);
                // Moss between stones on the path's outer edge.
                albedo = lerp(albedo, grass * 0.7, pm * saturate((0.75 - path) * 3.0) * (1 - cobH) * 0.8);
                // Decals from noise: grime, wet darkening, cracks.
                float grime = smoothstep(0.55, 0.85, fbm(xz * 0.35 + 9.0));
                albedo *= 1 - grime * 0.28;
                float wet = smoothstep(0.72, 0.8, fbm(xz * 0.21 + 31.0)) * pm;
                albedo *= 1 - wet * 0.35;
                float crack = smoothstep(0.03, 0.0, abs(fbm(xz * 0.9 + 3.0) - 0.5)) * (1 - pm) * (1 - g);
                albedo *= 1 - crack * 0.35;
                albedo *= lerp(0.88, 1.08, macro) * _Tint.rgb;

                half3 nC = nrm(TEXTURE2D_ARGS(_CobbleNormal, sampler_CobbleMap), uvC);
                half3 nD = nrm(TEXTURE2D_ARGS(_DirtNormal, sampler_CobbleMap), uvD);
                half3 nG = nrm(TEXTURE2D_ARGS(_GrassNormal, sampler_CobbleMap), uvG);
                half3 tn = normalize(lerp(lerp(nD, nG, g), nC, pm));
                // Ground plane: tangent +X, bitangent +Z, normal +Y.
                half3 n = normalize(half3(tn.x, tn.z, tn.y));
                float4 sc = TransformWorldToShadowCoord(i.w);
                Light L = GetMainLight(sc);
                half ndl = saturate(dot(n, L.direction));
                half ao = lerp(1.0, lerp(0.65, 1.0, cobH), pm);
                half3 lit = albedo * (SampleSH(n) * ao + L.color * ndl * L.shadowAttenuation);
                half spec = pow(saturate(dot(n, normalize(L.direction + normalize(GetCameraPositionWS() - i.w)))), 32) * (0.05 + wet * 0.5) * pm;
                lit += L.color * spec * L.shadowAttenuation;
                #if defined(_ADDITIONAL_LIGHTS)
                uint cnt = GetAdditionalLightsCount();
                for (uint li = 0u; li < cnt; li++)
                {
                    Light a = GetAdditionalLight(li, i.w);
                    lit += albedo * a.color * a.distanceAttenuation * saturate(dot(n, a.direction));
                }
                #endif
                lit = MixFog(lit, i.fog);
                return half4(lit, 1);
            }
            ENDHLSL
        }
        Pass
        {
            Name "ShadowCaster"
            Tags { "LightMode"="ShadowCaster" }
            ZWrite On ColorMask 0
            HLSLPROGRAM
            #pragma vertex v
            #pragma fragment f
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            float4 v(float4 p : POSITION) : SV_POSITION { return TransformObjectToHClip(p.xyz); }
            half4 f() : SV_Target { return 0; }
            ENDHLSL
        }
        Pass
        {
            Name "DepthOnly"
            Tags { "LightMode"="DepthOnly" }
            ZWrite On ColorMask R
            HLSLPROGRAM
            #pragma vertex v
            #pragma fragment f
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            float4 v(float4 p : POSITION) : SV_POSITION { return TransformObjectToHClip(p.xyz); }
            half4 f() : SV_Target { return 0; }
            ENDHLSL
        }
    }
    FallBack Off
}
