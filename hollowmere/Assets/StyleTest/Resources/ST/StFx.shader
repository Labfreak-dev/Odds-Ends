// Style test VFX: unlit vertex colour x _Color (HDR), alpha or additive blend, no depth write, two-sided. Used for slash arcs,
// projectiles, trails, sparks and ground telegraphs.
Shader "Hollowmere/StFx"
{
    Properties
    {
        [HDR] _Color ("Tint", Color) = (1,1,1,1)
        _Src ("Src blend", Float) = 5
        _Dst ("Dst blend", Float) = 10
        _ZT ("ZTest", Float) = 4
    }
    SubShader
    {
        Tags { "RenderType"="Transparent" "Queue"="Transparent" "RenderPipeline"="UniversalPipeline" }
        Pass
        {
            Tags { "LightMode"="UniversalForward" }
            Blend [_Src] [_Dst]
            ZWrite Off Cull Off ZTest [_ZT]
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            CBUFFER_START(UnityPerMaterial)
            half4 _Color; float _Src, _Dst, _ZT;
            CBUFFER_END
            struct A { float4 pos : POSITION; half4 col : COLOR; };
            struct V { float4 pos : SV_POSITION; half4 col : COLOR; };
            V vert(A i) { V o; o.pos = TransformObjectToHClip(i.pos.xyz); o.col = i.col * _Color; return o; }
            half4 frag(V i) : SV_Target { half4 c = i.col; c.rgb *= (_Dst == 1 ? c.a : 1); return c; }
            ENDHLSL
        }
    }
}
