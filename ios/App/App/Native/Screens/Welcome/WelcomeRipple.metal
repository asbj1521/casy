#include <metal_stdlib>
#include <SwiftUI/SwiftUI_Metal.h>
using namespace metal;

// The welcome's drop of glass landing on the calendars (#282, asked for on
// 21 Nov 2026): one long, slow ring of a wave runs out from `origin`, moving
// what is under it as water bends what lies beneath: each point is pushed
// along the line from the middle by the wave's height there, with a glint on
// each crest. The wave rises from nothing at its front, fades behind it, and
// dies down as time goes on. Lengths in the view's points, time in seconds.
[[ stitchable ]]
half4 casyRipple(float2 position, SwiftUI::Layer layer, float2 origin, float time,
                 float amplitude, float wavelength, float speed) {
    float2 d = position - origin;
    float dist = length(d);
    float phase = dist - speed * time;
    if (phase > 0.0 || dist < 0.001) {
        return layer.sample(position);
    }
    float k = 2.0 * M_PI_F / wavelength;
    float rise = smoothstep(0.0, wavelength * 0.5, -phase);
    float behind = exp(phase / (wavelength * 1.4));
    float settle = exp(-1.1 * time);
    float envelope = rise * behind * settle;
    float2 along = d / dist;
    half4 color = layer.sample(position + along * (amplitude * sin(k * phase) * envelope));
    float glint = cos(k * phase) * envelope;
    color.rgb = color.rgb + half3(0.10 * glint) * color.a;
    return color;
}
