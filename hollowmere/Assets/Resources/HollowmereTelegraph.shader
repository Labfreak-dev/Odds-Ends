// Ground attack telegraph. One unlit pass draws a cone, line, ring, or rune
// with a fill, a soft rim, an inner gradient, and scrolling noise.
// The first subshader is URP. The second is built-in so a missing URP
// variant cannot fall through to the opaque magenta error shader.
Shader "Hollowmere/Telegraph"
{
    Properties
    {
        [MainColor] _BaseColor ("Color", Color) = (1, 0.35, 0.08, 1)
        _Color ("Color", Color) = (1, 0.35, 0.08, 1)
        _EdgeColor ("Edge", Color) = (1, 0.8, 0.4, 1)
        _MainTex ("Noise", 2D) = "white" {}
        _Fill ("Fill", Range(0, 1)) = 0
        _Shape ("Shape", Float) = 0
        _Inner ("Inner", Range(0.05, 0.9)) = 0.62
        _FromOrigin ("From Origin", Float) = 1
        _Scroll ("Scroll", Float) = 0.45
        _Phase ("Phase", Float) = 0
        _Angle ("Angle", Float) = 80
        _Aspect ("Aspect", Float) = 0.2
        _HasNoise ("Has Noise", Float) = 0
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
            Offset -2, -2

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            TEXTURE2D(_MainTex);
            SAMPLER(sampler_MainTex);

            CBUFFER_START(UnityPerMaterial)
                half4 _BaseColor;
                half4 _Color;
                half4 _EdgeColor;
                float4 _MainTex_ST;
                half _Fill;
                half _Shape;
                half _Inner;
                half _FromOrigin;
                half _Scroll;
                half _Phase;
                half _Angle;
                half _Aspect;
                half _HasNoise;
            CBUFFER_END

            struct Attributes
            {
                float4 positionOS : POSITION;
                float2 uv : TEXCOORD0;
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float2 uv : TEXCOORD0;
            };

            float TgHash(float2 p)
            {
                return frac(sin(dot(p, float2(127.1, 311.7))) * 43758.5453);
            }

            float TgNoise(float2 p)
            {
                float2 i = floor(p);
                float2 f = frac(p);
                f = f * f * (3.0 - 2.0 * f);
                float a = TgHash(i);
                float b = TgHash(i + float2(1, 0));
                float c = TgHash(i + float2(0, 1));
                float d = TgHash(i + float2(1, 1));
                return lerp(lerp(a, b, f.x), lerp(c, d, f.x), f.y);
            }

            // x = filled body, y = glowing rim. Both 0..1.
            float2 TgMask(float2 uv, float shape, float fill, float inner, float fromOrigin, float hasNoise, float phase)
            {
                float along = uv.y;
                float2 p = uv * 2.0 - 1.0;
                float r = length(p);
                float n = TgNoise(uv * 7.0 + float2(phase, phase * 0.35));
                if (hasNoise > 0.5)
                {
                    float2 nuv = uv * _MainTex_ST.xy + float2(phase, 0);
                    float sampleN = SAMPLE_TEXTURE2D(_MainTex, sampler_MainTex, nuv).r;
                    n = saturate(n * 0.45 + sampleN * 0.85);
                }
                float body = 0;
                float rim = 0;
                if (shape < 0.5)
                {
                    // Arc sector on a disc. +Y in uv space is the attack direction.
                    float ang = atan2(abs(p.x), p.y);
                    float halfA = radians(max(_Angle, 24.0)) * 0.5;
                    float inArc = 1.0 - smoothstep(halfA - 0.07, halfA + 0.02, ang);
                    float inDisc = 1.0 - smoothstep(0.94, 1.03, r);
                    float inside = inArc * inDisc * smoothstep(-0.04, 0.05, p.y);
                    float reach = fromOrigin > 0.5 ? r : 1.0 - r;
                    float filled = 1.0 - smoothstep(fill - 0.02, fill + 0.045, reach);
                    float grad = lerp(0.22, 1.0, saturate(r * 0.85 + 0.15));
                    float mid = saturate(1.0 - ang / max(halfA, 0.05));
                    body = inside * lerp(0.16, grad * lerp(0.65, 1.0, mid), filled);
                    rim = saturate(1.0 - abs(r - 0.96) * 28.0) * inArc * smoothstep(0.0, 0.08, p.y);
                    rim += saturate(1.0 - abs(ang - halfA) * 16.0) * inDisc * smoothstep(0.04, 0.16, r);
                    rim += inside * saturate(1.0 - abs(r - fill) * 34.0) * filled;
                }
                else if (shape < 1.5)
                {
                    // Rounded shaft, arrow tip, chevrons scrolling toward the target.
                    float aspect = max(_Aspect, 0.035);
                    float halfW = aspect * 0.5;
                    float2 q = float2((uv.x - 0.5) * aspect, along);
                    float head = clamp(halfW * 3.4, 0.07, 0.2);
                    float2 segA = float2(0.0, halfW);
                    float2 segB = float2(0.0, 1.0 - head);
                    float2 pa = q - segA;
                    float2 ba = segB - segA;
                    float h = saturate(dot(pa, ba) / max(dot(ba, ba), 0.0001));
                    float shaft = length(pa - ba * h) - halfW * 0.92;
                    float ay = (q.y - (1.0 - head)) / max(head, 0.001);
                    float arrowHalf = halfW * 2.25 * saturate(1.05 - ay);
                    float arrow = (ay > -0.05 && ay < 1.05) ? abs(q.x) - arrowHalf : 1.0;
                    float d = min(shaft, arrow);
                    float inside = 1.0 - smoothstep(-0.002, max(halfW * 0.55, 0.008), d);
                    float reach = fromOrigin > 0.5 ? q.y : 1.0 - q.y;
                    float filled = 1.0 - smoothstep(fill - 0.015, fill + 0.03, reach);
                    float v = abs(q.x) / max(halfW, 0.001);
                    float grad = lerp(0.32, 1.0, saturate(q.y / max(fill, 0.05))) * lerp(1.0, 0.45, saturate(v));
                    float chevU = frac(q.y * 7.0 - phase * 1.35);
                    float chev = smoothstep(0.16, 0.02, abs(chevU - 0.2 - saturate(v) * 0.18));
                    float core = smoothstep(0.42, 0.0, v);
                    body = inside * lerp(0.14, grad, filled);
                    body += inside * filled * chev * 0.85;
                    body += inside * filled * core * 0.4;
                    rim = saturate(1.0 - abs(d) / max(halfW * 0.42, 0.01));
                    rim += inside * saturate(1.0 - abs(q.y - fill) * 28.0);
                }
                else if (shape < 2.5)
                {
                    float outer = smoothstep(1.02, 0.9, r);
                    float hole = smoothstep(inner - 0.02, inner + 0.03, r);
                    float band = outer * hole;
                    float fillEdge = fromOrigin > 0.5 ? lerp(inner, 1.0, fill) : lerp(1.0, inner, fill);
                    float filled = fromOrigin > 0.5 ? step(r, fillEdge) : step(fillEdge, r);
                    body = band * filled;
                    rim = saturate(1.0 - abs(r - 0.96) * 22.0);
                    rim += saturate(1.0 - abs(r - inner) * 22.0) * outer;
                    rim += band * saturate(1.0 - abs(r - fillEdge) * 26.0);
                }
                else
                {
                    float disc = smoothstep(1.02, 0.9, r);
                    float ang = atan2(p.y, p.x);
                    float spokes = pow(abs(sin(ang * 4.0)), 12.0);
                    float ring = saturate(1.0 - abs(r - 0.72) * 18.0);
                    float core = smoothstep(0.28, 0.02, r);
                    float glyph = saturate(spokes * smoothstep(0.18, 0.34, r) + ring * 0.85 + core);
                    glyph = saturate(glyph + n * 0.35 * disc);
                    float front = fromOrigin > 0.5 ? r : 1.0 - r;
                    body = disc * glyph * (1.0 - smoothstep(fill - 0.02, fill + 0.04, front));
                    rim = saturate(1.0 - abs(r - 0.96) * 20.0);
                    rim += disc * saturate(1.0 - abs(front - fill) * 22.0) * glyph;
                }
                body *= lerp(0.55, 1.0, n);
                return float2(saturate(body), saturate(rim));
            }

            Varyings vert(Attributes v)
            {
                Varyings o;
                o.positionCS = TransformObjectToHClip(v.positionOS.xyz);
                o.uv = v.uv;
                return o;
            }

            half4 frag(Varyings i) : SV_Target
            {
                float2 m = TgMask(i.uv, _Shape, _Fill, _Inner, _FromOrigin, _HasNoise, _Phase);
                float glow = saturate(m.x + m.y * 0.85);
                clip(glow - 0.02);
                half3 rgb = _BaseColor.rgb * (m.x * lerp(0.35, 1.0, m.x) + m.y);
                rgb += _EdgeColor.rgb * m.y;
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
            Offset -2, -2

            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            sampler2D _MainTex;
            float4 _MainTex_ST;
            fixed4 _BaseColor;
            fixed4 _EdgeColor;
            float _Fill, _Shape, _Inner, _FromOrigin, _Scroll, _Phase, _Angle, _Aspect, _HasNoise;

            struct appdata
            {
                float4 vertex : POSITION;
                float2 uv : TEXCOORD0;
            };

            struct v2f
            {
                float4 pos : SV_POSITION;
                float2 uv : TEXCOORD0;
            };

            float TgHash(float2 p)
            {
                return frac(sin(dot(p, float2(127.1, 311.7))) * 43758.5453);
            }

            float TgNoise(float2 p)
            {
                float2 i = floor(p);
                float2 f = frac(p);
                f = f * f * (3.0 - 2.0 * f);
                return lerp(lerp(TgHash(i), TgHash(i + float2(1, 0)), f.x), lerp(TgHash(i + float2(0, 1)), TgHash(i + float2(1, 1)), f.x), f.y);
            }

            float2 TgMask(float2 uv)
            {
                float along = uv.y;
                float2 p = uv * 2.0 - 1.0;
                float r = length(p);
                float n = TgNoise(uv * 7.0 + float2(_Phase, 0));
                if (_HasNoise > 0.5)
                    n = saturate(n * 0.45 + tex2D(_MainTex, uv * _MainTex_ST.xy + float2(_Phase, 0)).r * 0.85);
                float body = 0;
                float rim = 0;
                if (_Shape < 0.5)
                {
                    float ang = atan2(abs(p.x), p.y);
                    float halfA = radians(max(_Angle, 24.0)) * 0.5;
                    float inArc = 1.0 - smoothstep(halfA - 0.07, halfA + 0.02, ang);
                    float inDisc = 1.0 - smoothstep(0.94, 1.03, r);
                    float inside = inArc * inDisc * smoothstep(-0.04, 0.05, p.y);
                    float reach = _FromOrigin > 0.5 ? r : 1.0 - r;
                    float filled = 1.0 - smoothstep(_Fill - 0.02, _Fill + 0.045, reach);
                    float grad = lerp(0.22, 1.0, saturate(r * 0.85 + 0.15));
                    float mid = saturate(1.0 - ang / max(halfA, 0.05));
                    body = inside * lerp(0.16, grad * lerp(0.65, 1.0, mid), filled);
                    rim = saturate(1.0 - abs(r - 0.96) * 28.0) * inArc * smoothstep(0.0, 0.08, p.y);
                    rim += saturate(1.0 - abs(ang - halfA) * 16.0) * inDisc * smoothstep(0.04, 0.16, r);
                    rim += inside * saturate(1.0 - abs(r - _Fill) * 34.0);
                }
                else if (_Shape < 1.5)
                {
                    float aspect = max(_Aspect, 0.035);
                    float halfW = aspect * 0.5;
                    float2 q = float2((uv.x - 0.5) * aspect, along);
                    float head = clamp(halfW * 3.4, 0.07, 0.2);
                    float2 segA = float2(0.0, halfW);
                    float2 segB = float2(0.0, 1.0 - head);
                    float2 pa = q - segA;
                    float2 ba = segB - segA;
                    float h = saturate(dot(pa, ba) / max(dot(ba, ba), 0.0001));
                    float shaft = length(pa - ba * h) - halfW * 0.92;
                    float ay = (q.y - (1.0 - head)) / max(head, 0.001);
                    float arrowHalf = halfW * 2.25 * saturate(1.05 - ay);
                    float arrow = (ay > -0.05 && ay < 1.05) ? abs(q.x) - arrowHalf : 1.0;
                    float d = min(shaft, arrow);
                    float inside = 1.0 - smoothstep(-0.002, max(halfW * 0.55, 0.008), d);
                    float reach = _FromOrigin > 0.5 ? q.y : 1.0 - q.y;
                    float filled = 1.0 - smoothstep(_Fill - 0.015, _Fill + 0.03, reach);
                    float v = abs(q.x) / max(halfW, 0.001);
                    float grad = lerp(0.32, 1.0, saturate(q.y / max(_Fill, 0.05))) * lerp(1.0, 0.45, saturate(v));
                    float chevU = frac(q.y * 7.0 - _Phase * 1.35);
                    float chev = smoothstep(0.16, 0.02, abs(chevU - 0.2 - saturate(v) * 0.18));
                    body = inside * lerp(0.14, grad, filled);
                    body += inside * filled * chev * 0.85;
                    body += inside * filled * smoothstep(0.42, 0.0, v) * 0.4;
                    rim = saturate(1.0 - abs(d) / max(halfW * 0.42, 0.01));
                    rim += inside * saturate(1.0 - abs(q.y - _Fill) * 28.0);
                }
                else if (_Shape < 2.5)
                {
                    float band = smoothstep(1.02, 0.9, r) * smoothstep(_Inner - 0.02, _Inner + 0.03, r);
                    float fillEdge = _FromOrigin > 0.5 ? lerp(_Inner, 1.0, _Fill) : lerp(1.0, _Inner, _Fill);
                    float filled = _FromOrigin > 0.5 ? step(r, fillEdge) : step(fillEdge, r);
                    body = band * filled;
                    rim = saturate(1.0 - abs(r - 0.96) * 22.0);
                    rim += band * saturate(1.0 - abs(r - fillEdge) * 26.0);
                }
                else
                {
                    float disc = smoothstep(1.02, 0.9, r);
                    float ang = atan2(p.y, p.x);
                    float spokes = pow(abs(sin(ang * 4.0)), 12.0);
                    float glyph = saturate(spokes * smoothstep(0.18, 0.34, r) + saturate(1.0 - abs(r - 0.72) * 18.0) + smoothstep(0.28, 0.02, r));
                    glyph = saturate(glyph + n * 0.35 * disc);
                    float front = _FromOrigin > 0.5 ? r : 1.0 - r;
                    body = disc * glyph * (1.0 - smoothstep(_Fill - 0.02, _Fill + 0.04, front));
                    rim = saturate(1.0 - abs(r - 0.96) * 20.0);
                }
                body *= lerp(0.55, 1.0, n);
                return float2(saturate(body), saturate(rim));
            }

            v2f vert(appdata v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.uv = v.uv;
                return o;
            }

            fixed4 frag(v2f i) : SV_Target
            {
                float2 m = TgMask(i.uv);
                float glow = saturate(m.x + m.y * 0.85);
                clip(glow - 0.02);
                fixed3 rgb = _BaseColor.rgb * (m.x + m.y) + _EdgeColor.rgb * m.y;
                return fixed4(rgb, 1);
            }
            ENDCG
        }
    }
}
