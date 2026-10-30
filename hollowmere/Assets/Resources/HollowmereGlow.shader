// Additive unlit sprite for spell cores, trails and impact flashes.
// One pass, no keywords, so it does not explode the shader variant count.
// Referenced by Resources/HollowmereGlow.mat and listed in Always Included Shaders.
Shader "Hollowmere/Glow"
{
    Properties
    {
        [MainColor] _BaseColor ("Color", Color) = (0.7, 0.35, 1, 1)
        _Color ("Color", Color) = (0.7, 0.35, 1, 1)
        _EmissionColor ("Emission", Color) = (0.7, 0.35, 1, 1)
        _UseVertexColor ("Use Vertex Color", Float) = 0
    }
    SubShader
    {
        Tags
        {
            "RenderType" = "Transparent"
            "Queue" = "Transparent"
            "RenderPipeline" = "UniversalPipeline"
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
                half4 _EmissionColor;
                half _UseVertexColor;
            CBUFFER_END

            struct Attributes
            {
                float4 positionOS : POSITION;
                half4 color : COLOR;
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                half4 color : COLOR;
            };

            Varyings vert(Attributes v)
            {
                Varyings o;
                o.positionCS = TransformObjectToHClip(v.positionOS.xyz);
                o.color = v.color;
                return o;
            }

            half4 frag(Varyings i) : SV_Target
            {
                half3 rgb = _BaseColor.rgb;
                if (_UseVertexColor > 0.5)
                    rgb *= i.color.rgb * i.color.a;
                return half4(rgb, 1);
            }
            ENDHLSL
        }
    }
    FallBack Off
}
