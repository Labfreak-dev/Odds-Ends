// Style test: soft alpha-blended smoke puff (texture alpha x colour), lit only by fog.
Shader "Hollowmere/StSmoke"
{
    Properties { _MainTex ("Tex", 2D) = "white" {} _Color ("Color", Color) = (1,1,1,0.5) }
    SubShader
    {
        Tags { "RenderType"="Transparent" "Queue"="Transparent" "RenderPipeline"="UniversalPipeline" }
        Pass
        {
            Blend SrcAlpha OneMinusSrcAlpha ZWrite Off Cull Off
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_fog
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            TEXTURE2D(_MainTex); SAMPLER(sampler_MainTex);
            CBUFFER_START(UnityPerMaterial) float4 _MainTex_ST; half4 _Color; CBUFFER_END
            struct A { float4 pos:POSITION; float2 uv:TEXCOORD0; };
            struct V { float4 pos:SV_POSITION; float2 uv:TEXCOORD0; half fog:TEXCOORD1; };
            V vert(A i) { V o; o.pos = TransformObjectToHClip(i.pos.xyz); o.uv = i.uv; o.fog = ComputeFogFactor(o.pos.z); return o; }
            half4 frag(V i) : SV_Target { half4 t = SAMPLE_TEXTURE2D(_MainTex, sampler_MainTex, i.uv) * _Color; t.rgb = MixFog(t.rgb, i.fog); return t; }
            ENDHLSL
        }
    }
}
