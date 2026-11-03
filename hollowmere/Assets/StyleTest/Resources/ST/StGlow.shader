// Style test: additive overlay glow (fresnel rim on meshes, soft ring/orb on quads). Overlay only, never changes the base look.
Shader "Hollowmere/StGlow"
{
    Properties
    {
        [HDR] _Color ("Color", Color) = (1,0.8,0.3,1)
        _Power ("Rim power", Float) = 2.5
        _Mode ("0 rim, 1 ring quad, 2 orb", Float) = 0
        _Pulse ("Pulse", Float) = 1
    }
    SubShader
    {
        Tags { "RenderType"="Transparent" "Queue"="Transparent" "RenderPipeline"="UniversalPipeline" }
        Pass
        {
            Blend One One
            ZWrite Off
            Cull Back
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            CBUFFER_START(UnityPerMaterial)
            half4 _Color; float _Power; float _Mode; float _Pulse;
            CBUFFER_END
            struct A { float4 pos:POSITION; float3 n:NORMAL; float2 uv:TEXCOORD0; };
            struct V { float4 pos:SV_POSITION; float3 n:TEXCOORD0; float3 v:TEXCOORD1; float2 uv:TEXCOORD2; };
            V vert(A i)
            {
                V o;
                float3 w = TransformObjectToWorld(i.pos.xyz);
                o.pos = TransformWorldToHClip(w);
                o.n = TransformObjectToWorldNormal(i.n);
                o.v = GetWorldSpaceViewDir(w);
                o.uv = i.uv;
                return o;
            }
            half4 frag(V i):SV_Target
            {
                float pulse = lerp(1, 0.75 + 0.25 * sin(_Time.y * 3.0), saturate(_Pulse));
                if (_Mode < 0.5)
                {
                    float f = pow(1 - saturate(dot(normalize(i.n), normalize(i.v))), _Power);
                    return half4(_Color.rgb * f * pulse, 1);
                }
                float r = length(i.uv - 0.5) * 2;
                if (_Mode < 1.5)
                {
                    float ring = exp(-pow((r - 0.8) * 9, 2)) + 0.35 * exp(-pow((r - 0.55) * 14, 2));
                    float runes = 0.5 + 0.5 * sin(atan2(i.uv.y - 0.5, i.uv.x - 0.5) * 12 + _Time.y * 1.5);
                    ring *= lerp(0.6, 1.0, runes) * saturate(1 - (r - 0.95) * 20);
                    return half4(_Color.rgb * ring * pulse, 1);
                }
                float orb = saturate(1 - r); orb = orb * orb;
                return half4(_Color.rgb * orb * pulse, 1);
            }
            ENDHLSL
        }
    }
}
