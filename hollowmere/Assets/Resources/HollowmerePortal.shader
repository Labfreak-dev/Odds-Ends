// Animated arch fill. The old disc was Hollowmere/Color (always included, not a
// stripped shader) with a purple emission, which read as a flat pink card.
Shader "Hollowmere/Portal"
{
    Properties
    {
        [MainColor] _BaseColor ("Color", Color) = (0.35, 0.55, 1, 1)
        _Color ("Color", Color) = (0.35, 0.55, 1, 1)
        _Speed ("Speed", Float) = 0.35
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

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            CBUFFER_START(UnityPerMaterial)
                half4 _BaseColor;
                half4 _Color;
                half _Speed;
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

            Varyings vert(Attributes v)
            {
                Varyings o;
                o.positionCS = TransformObjectToHClip(v.positionOS.xyz);
                o.uv = v.uv;
                return o;
            }

            half4 frag(Varyings i) : SV_Target
            {
                float2 p = i.uv * 2.0 - 1.0;
                float r = length(p);
                float ang = atan2(p.y, p.x);
                float t = _Time.y * _Speed;
                float ring = saturate(1.0 - abs(r - 0.55 - 0.18 * sin(ang * 3.0 + t * 2.0)) * 4.0);
                float spin = 0.5 + 0.5 * sin(ang * 6.0 - t * 4.0 + r * 8.0);
                float disc = saturate(1.0 - r);
                disc *= disc;
                half3 rgb = _BaseColor.rgb * (disc * 0.35 + ring * spin);
                return half4(rgb, 1);
            }
            ENDHLSL
        }
    }
    FallBack Off
}
