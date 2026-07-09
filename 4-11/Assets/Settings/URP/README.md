# URP Configuration for Metaverse Project

This folder contains the Universal Render Pipeline (URP) configuration assets for the metaverse gallery project.

## Files Overview

### URP Assets (Pipeline Configuration)
- **MetaverseURP-HighQuality.asset** - High-quality settings for desktop/high-end devices
  - 4x MSAA anti-aliasing
  - 2048px shadow resolution
  - 4 shadow cascades
  - Up to 8 additional lights per object
  - 150 unit shadow distance

- **MetaverseURP-MediumQuality.asset** - Optimized settings for mid-range devices/VR
  - 2x MSAA anti-aliasing
  - 1024px shadow resolution
  - 2 shadow cascades
  - Up to 4 additional lights per object
  - 100 unit shadow distance

### Renderer Asset
- **MetaverseForwardRenderer.asset** - Forward rendering configuration
  - Shared by both quality levels
  - Configured for realistic gallery rendering
  - Supports depth texture for post-processing

### Post-Processing Profile
- **MetaversePostProcessing.asset** - Visual effects configuration
  - ✓ Bloom (lighting glow effects)
  - ✓ Color Grading (mood and atmosphere control)
  - ✓ Tonemapping (HDR to display mapping)
  - ✓ Ambient Occlusion (depth and realism)
  - ✓ Depth of Field (optional focus effects)
  - ✓ Vignette (subtle frame darkening)

### Documentation
- **URP-SETUP-GUIDE.md** - Complete setup and configuration guide
- **README.md** - This file

## Quick Setup

1. **Assign URP Asset**:
   - Edit > Project Settings > Graphics
   - Set "Scriptable Render Pipeline Settings" to MetaverseURP-HighQuality

2. **Convert Materials**:
   - Edit > Render Pipeline > Universal Render Pipeline > Upgrade Project Materials to URP Materials

3. **Add Post-Processing**:
   - Create GameObject > Volume > Global Volume
   - Assign MetaversePostProcessing profile
   - Enable "Is Global"

4. **Read the Full Guide**:
   - Open URP-SETUP-GUIDE.md for detailed instructions

## Technical Specifications

- **Unity Version**: 2021.3.9f1
- **URP Version**: 12.1.8
- **Render Path**: Forward
- **Color Space**: Linear (recommended)
- **Platform**: Multi-platform (PC, VR, Web)

## Features Enabled

### Rendering
- [x] HDR rendering
- [x] MSAA anti-aliasing
- [x] Soft shadows
- [x] Depth texture
- [x] SRP Batcher (performance)
- [x] Reflection probes
- [x] Box projection

### Lighting
- [x] Main directional light with shadows
- [x] Additional per-pixel lights (4-8)
- [x] Shadow cascades (2-4)
- [x] Soft shadow support
- [x] Mixed lighting mode support

### Post-Processing
- [x] Bloom
- [x] Color Grading
- [x] Tonemapping
- [x] Ambient Occlusion
- [x] Depth of Field
- [x] Vignette

## Performance Notes

### High Quality
- Target: Desktop, High-end PC
- Expected FPS: 60+ on modern GPUs
- Use for: Final builds, showcases

### Medium Quality
- Target: Mid-range PC, VR headsets, Web
- Expected FPS: 60+ on GTX 1060 equivalent
- Use for: Broader compatibility

## Gallery-Specific Optimizations

These settings are optimized for:
- Indoor gallery spaces
- Multiple artworks with spotlight illumination
- Realistic material rendering (PBR)
- Cinematic presentation
- VR compatibility (medium quality)

## Next Steps

1. Review URP-SETUP-GUIDE.md for detailed setup instructions
2. Configure Project Settings to use URP
3. Convert existing materials to URP shaders
4. Set up lighting for your gallery scenes
5. Add Global Volume for post-processing
6. Test performance and adjust quality settings

## Support

For issues or questions:
1. Check URP-SETUP-GUIDE.md troubleshooting section
2. Review Unity URP documentation
3. Test with URP sample scenes
4. Profile performance with Unity Profiler

---

**Project**: Metaverse Gallery
**Version**: 1.0
**Last Updated**: July 9, 2026
