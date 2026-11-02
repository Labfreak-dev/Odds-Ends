// Style test: shared stylized surface for every imported kit (KayKit, Quaternius, algumacoisaqq VK).
// albedo = _BaseMap * _BaseColor * (vertex colour if _UseVC), soft two-band ramp on the main light, main-light shadows,
// per-vertex additional lights (lanterns/torches), SH ambient, fog. Keeps one consistent look across packs.
Shader "Hollowmere/StToon"
{
    Properties
    {
        _BaseMap ("Base", 2D) = "white" {}
        _BaseColor ("Color", Color) = (1,1,1,1)
        _UseVC ("Use vertex colour", Float) = 0
        _Ramp ("Ramp softness", Range(0.01,1)) = 0.35
        _Shade ("Shadow side brightness", Range(0,1)) = 0.55
        _Cutoff ("Alpha cutoff", Range(0,1)) = 0
        [HDR] _Emission ("Emission", Color) = (0,0,0,0)
        _Cull ("Cull", Float) = 2
        _SelfLit ("Self-lit (albedo)", Range(0,1)) = 0
        _Outline ("Outline width (screen, 0=off)", Range(0,4)) = 0
        _OutlineDark ("Outline = albedo x", Range(0,1)) = 0.25
        _Rim ("Edge darkening", Range(0,1)) = 0.35
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" "Queue"="Geometry" "RenderPipeline"="UniversalPipeline" }
        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode"="UniversalForward" }
            Cull [_Cull]
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile_fragment _ _SHADOWS_SOFT
            #pragma multi_compile _ _ADDITIONAL_LIGHTS
            #pragma multi_compile_fog
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
            TEXTURE2D(_BaseMap); SAMPLER(sampler_BaseMap);
            CBUFFER_START(UnityPerMaterial)
            float4 _BaseMap_ST; half4 _BaseColor; half _UseVC; half _Ramp; half _Shade; half _Cutoff; half4 _Emission; half _Cull; half _SelfLit; half _Outline; half _OutlineDark; half _Rim;
            CBUFFER_END
            struct A { float4 pos:POSITION; float3 n:NORMAL; float2 uv:TEXCOORD0; half4 col:COLOR; };
            struct V { float4 pos:SV_POSITION; float2 uv:TEXCOORD0; float3 wp:TEXCOORD1; float3 n:TEXCOORD2; half4 col:COLOR; half3 add:TEXCOORD3; half fog:TEXCOORD4; };
            V vert(A i)
            {
                V o; VertexPositionInputs p = GetVertexPositionInputs(i.pos.xyz);
                o.pos = p.positionCS; o.wp = p.positionWS; o.n = TransformObjectToWorldNormal(i.n);
                o.uv = TRANSFORM_TEX(i.uv, _BaseMap); o.col = i.col; o.fog = ComputeFogFactor(p.positionCS.z);
                o.add = 0; return o;
            }
            half4 frag(V i, bool front : SV_IsFrontFace) : SV_Target
            {
                half4 t = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, i.uv) * _BaseColor;
                if (_UseVC > 0.5) t.rgb *= i.col.rgb;
                clip(t.a - _Cutoff);
                float3 n = normalize(i.n); if (!front) n = -n;
                Light ml = GetMainLight(TransformWorldToShadowCoord(i.wp));
                half ndl = dot(n, ml.direction);
                half band = smoothstep(-_Ramp * 0.5, _Ramp * 0.5, ndl);
                half sh = lerp(1, ml.shadowAttenuation, 0.85);
                half3 lit = ml.color * lerp(_Shade, 1.0, band * sh);
                half3 amb = SampleSH(n);
                #if defined(_ADDITIONAL_LIGHTS)
                uint cnt = min(GetAdditionalLightsCount(), 8u);
                for (uint k = 0u; k < cnt; k++) { Light l = GetAdditionalLight(k, i.wp); i.add += l.color * l.distanceAttenuation * saturate(dot(n, l.direction) * 0.6 + 0.4); }
                #endif
                half3 vd = normalize(GetWorldSpaceViewDir(i.wp));
                half edge = pow(1 - saturate(dot(n, vd)), 3) * _Rim;
                half3 c = t.rgb * (lit * 0.85 + amb + i.add) * (1 - edge) + _Emission.rgb;
                c = lerp(c, t.rgb, _SelfLit);
                c = MixFog(c, i.fog);
                return half4(c, 1);
            }
            ENDHLSL
        }
        Pass
        {
            Name "Outline"
            Tags { "LightMode"="SRPDefaultUnlit" }
            Cull Front ZWrite On
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_fog
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            TEXTURE2D(_BaseMap); SAMPLER(sampler_BaseMap);
            CBUFFER_START(UnityPerMaterial)
            float4 _BaseMap_ST; half4 _BaseColor; half _UseVC; half _Ramp; half _Shade; half _Cutoff; half4 _Emission; half _Cull; half _SelfLit; half _Outline; half _OutlineDark; half _Rim;
            CBUFFER_END
            struct A { float4 pos:POSITION; float3 n:NORMAL; float2 uv:TEXCOORD0; half4 col:COLOR; };
            struct V { float4 pos:SV_POSITION; float2 uv:TEXCOORD0; half4 col:COLOR; half fog:TEXCOORD1; };
            V vert(A i)
            {
                V o; float4 c = TransformObjectToHClip(i.pos.xyz);
                float3 nv = mul((float3x3)UNITY_MATRIX_VP, TransformObjectToWorldNormal(i.n));
                float2 d = normalize(nv.xy + 1e-5);
                c.xy += d * _Outline * 0.0016 * c.w * float2(_ScreenParams.y / _ScreenParams.x, 1);
                if (_Outline <= 0) c = float4(0, 0, -10, 1);
                o.pos = c; o.uv = TRANSFORM_TEX(i.uv, _BaseMap); o.col = i.col; o.fog = ComputeFogFactor(c.z); return o;
            }
            half4 frag(V i) : SV_Target
            {
                half4 t = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, i.uv) * _BaseColor;
                if (_UseVC > 0.5) t.rgb *= i.col.rgb;
                return half4(MixFog(t.rgb * _OutlineDark, i.fog), 1);
            }
            ENDHLSL
        }
        Pass
        {
            Name "ShadowCaster"
            Tags { "LightMode"="ShadowCaster" }
            ZWrite On ZTest LEqual ColorMask 0 Cull [_Cull]
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
            float3 _LightDirection;
            struct A { float4 pos:POSITION; float3 n:NORMAL; };
            float4 vert(A i) : SV_POSITION
            {
                float3 wp = TransformObjectToWorld(i.pos.xyz); float3 wn = TransformObjectToWorldNormal(i.n);
                float4 c = TransformWorldToHClip(ApplyShadowBias(wp, wn, _LightDirection));
                #if UNITY_REVERSED_Z
                c.z = min(c.z, UNITY_NEAR_CLIP_VALUE);
                #else
                c.z = max(c.z, UNITY_NEAR_CLIP_VALUE);
                #endif
                return c;
            }
            half4 frag() : SV_Target { return 0; }
            ENDHLSL
        }
        Pass
        {
            Name "DepthOnly"
            Tags { "LightMode"="DepthOnly" }
            ZWrite On ColorMask R Cull [_Cull]
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            float4 vert(float4 p:POSITION) : SV_POSITION { return TransformObjectToHClip(p.xyz); }
            half frag() : SV_Target { return 0; }
            ENDHLSL
        }
    }
}
