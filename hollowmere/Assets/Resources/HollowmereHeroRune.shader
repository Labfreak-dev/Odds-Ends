// Hero ground rune (replaces the 20-cube dashed ring). Procedural, no texture: outer and inner rings,
// 12 rotating glyph cells between them, an animated fill sweep, a breathing pulse, and a soft inner halo.
// Additive, depth-tested, flat on the ground. Mobile-cheap (one quad, ALU only).
Shader "Hollowmere/HeroRune"
{
    Properties
    {
        _BaseColor ("Color", Color) = (1, 0.75, 0.45, 1)
        _Accent ("Accent", Color) = (1, 0.95, 0.8, 1)
        _Intensity ("Intensity", Float) = 1.6
        _Spin ("Spin (rad/s)", Float) = 0.25
        _Fill ("Fill sweep speed", Float) = 0.6
    }
    SubShader
    {
        Tags { "RenderType"="Transparent" "Queue"="Transparent-10" "RenderPipeline"="UniversalPipeline" "IgnoreProjector"="True" }
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
            CBUFFER_START(UnityPerMaterial)
                half4 _BaseColor; half4 _Accent; half _Intensity; half _Spin; half _Fill;
            CBUFFER_END
            struct A { float4 p : POSITION; float2 uv : TEXCOORD0; };
            struct V { float4 p : SV_POSITION; float2 uv : TEXCOORD0; };
            V vert(A i) { V o; o.p = TransformObjectToHClip(i.p.xyz); o.uv = i.uv * 2.0 - 1.0; return o; }
            float hash(float n) { return frac(sin(n * 91.345) * 47453.21); }
            float band(float r, float c, float w) { float d = abs(r - c); float aa = fwidth(r) * 1.5; return 1.0 - smoothstep(w - aa, w + aa, d); }
            half4 frag(V i) : SV_Target
            {
                float r = length(i.uv);
                if (r > 1.0) discard;
                float t = _Time.y;
                float a = atan2(i.uv.y, i.uv.x);
                const float TAU = 6.2831853;
                // Rings: bold outer, thin double inner.
                float outer = band(r, 0.90, 0.030) + 0.45 * band(r, 0.965, 0.008);
                float inner = band(r, 0.66, 0.010) + band(r, 0.62, 0.006);
                // Glyph cells between 0.68 and 0.86, counter-rotating.
                float ga = frac((a + t * _Spin) / TAU) * 12.0;
                float cell = floor(ga); float u = frac(ga); float v = saturate((r - 0.69) / 0.16);
                float h = hash(cell + 3.0);
                float glyph = 0.0;
                float aa = 0.06;
                // vertical stroke, cross bar, chevron, dot — picked per cell.
                glyph += step(0.25, h) * (1.0 - smoothstep(0.05, 0.05 + aa, abs(u - 0.5))) * step(0.12, v) * step(v, 0.88);
                glyph += step(0.5, frac(h * 7.0)) * (1.0 - smoothstep(0.05, 0.05 + aa, abs(v - 0.5))) * step(0.22, u) * step(u, 0.78);
                glyph += step(0.6, frac(h * 13.0)) * (1.0 - smoothstep(0.05, 0.05 + aa, abs(abs(u - 0.5) * 1.6 - (v - 0.15)))) * step(v, 0.75);
                glyph += step(frac(h * 29.0), 0.35) * (1.0 - smoothstep(0.09, 0.09 + aa, length(float2(u - 0.5, v - 0.85) * float2(1.0, 1.4))));
                // Separators between cells.
                glyph += (1.0 - smoothstep(0.015, 0.05, min(u, 1.0 - u))) * step(0.3, v) * step(v, 0.7) * 0.6;
                glyph = saturate(glyph) * step(0.68, r) * step(r, 0.86);
                // Ticks on the outer ring, rotating the other way.
                float ta = frac((a - t * _Spin * 0.5) / TAU) * 48.0;
                float tick = (1.0 - smoothstep(0.08, 0.2, abs(frac(ta) - 0.5) * 2.0 - 0.8)) * band(r, 0.90, 0.045) * 0.0;
                tick = step(0.86, 1.0 - abs(frac(ta) - 0.5) * 2.0) * step(0.86, r) * step(r, 0.94);
                // Animated fill: a bright sweep that travels around, plus a slow breath.
                float sweep = pow(frac((a / TAU) - t * _Fill * 0.25), 6.0);
                float breath = 0.8 + 0.2 * sin(t * 2.2);
                float halo = smoothstep(0.62, 0.0, r) * 0.10 + smoothstep(0.80, 0.98, r) * smoothstep(1.0, 0.9, r) * 0.25;
                float body = outer * (0.8 + 0.9 * sweep) + inner * 0.7 + glyph * (0.55 + 0.6 * sweep) + tick * 0.5;
                half3 col = lerp(_BaseColor.rgb, _Accent.rgb, saturate(sweep * 0.8 + glyph * 0.2));
                half3 o = col * (body * breath + halo) * _Intensity;
                return half4(o, 1);
            }
            ENDHLSL
        }
    }
    FallBack Off
}
