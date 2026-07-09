# Unity URP Setup Guide for Metaverse Project

This guide explains how to configure and use the Universal Render Pipeline (URP) assets created for the metaverse gallery project.

## Project Information
- Unity Version: 2021.3.9f1
- URP Version: 12.1.8
- Working Directory: /home/user/lifeunity/4-11/

---

## Quick Start Checklist

- [ ] Assign URP asset in Project Settings
- [ ] Convert existing materials to URP/Lit shader
- [ ] Add Global Volume with Post-Processing Profile
- [ ] Configure lighting for gallery spaces
- [ ] Set up Quality levels
- [ ] Test performance on target platforms

---

## 1. Assign URP Asset in Project Settings

### Steps:
1. Open Unity Editor
2. Go to **Edit > Project Settings > Graphics**
3. In the **Scriptable Render Pipeline Settings** field, assign:
   - **High Quality**: `Assets/Settings/URP/MetaverseURP-HighQuality`
   - **Medium Quality**: `Assets/Settings/URP/MetaverseURP-MediumQuality`
   
   Start with **MetaverseURP-HighQuality** for development.

4. Go to **Edit > Project Settings > Quality**
5. For each quality level, assign the corresponding URP asset in the **Render Pipeline Asset** field:
   - Ultra: MetaverseURP-HighQuality
   - High: MetaverseURP-HighQuality
   - Medium: MetaverseURP-MediumQuality
   - Low: MetaverseURP-MediumQuality

### Verification:
- The scene view should update with better lighting
- Materials using Standard shader will appear pink (this is expected - see next section)

---

## 2. Convert Existing Materials to URP

### Automatic Conversion (Recommended):
1. Go to **Edit > Render Pipeline > Universal Render Pipeline**
2. Select **Upgrade Project Materials to URP Materials**
3. Click **Proceed** in the dialog
4. Wait for the conversion to complete

### Manual Conversion:
For individual materials:
1. Select the material in the Project window
2. In the Inspector, change **Shader** dropdown to:
   - **Universal Render Pipeline/Lit** (for standard materials)
   - **Universal Render Pipeline/Simple Lit** (for mobile/performance)
   - **Universal Render Pipeline/Unlit** (for UI or special effects)

### Common URP Shaders:
- **URP/Lit**: Standard PBR shader with full features
- **URP/Simple Lit**: Simpler lighting for better performance
- **URP/Unlit**: No lighting, good for UI and effects
- **URP/Terrain/Lit**: For terrain materials
- **URP/Particles/Lit**: For particle systems

---

## 3. Set Up Post-Processing Volume

### Create Global Volume GameObject:
1. In Hierarchy, right-click > **Volume > Global Volume**
2. Name it "Global Post Processing"
3. In the Inspector:
   - Enable **Is Global**
   - Set **Priority** to 0
   - Assign **Profile**: `Assets/Settings/URP/MetaversePostProcessing`

### Post-Processing Effects Included:

#### Bloom (Lighting Glow)
- **Threshold**: 0.9 - Only bright areas bloom
- **Intensity**: 0.5 - Moderate glow effect
- **Scatter**: 0.7 - How much bloom spreads
- **Use Case**: Gallery lights, emissive materials, highlights

#### Color Grading (Mood/Atmosphere)
- **Post Exposure**: 0.2 - Slightly brighter overall
- **Contrast**: 5 - Enhanced depth
- **Saturation**: 5 - Richer colors
- **Tonemapping**: Neutral - Balanced HDR mapping
- **Use Case**: Overall mood control for different gallery zones

#### Ambient Occlusion (Depth/Realism)
- **Intensity**: 0.5 - Moderate shadow in crevices
- **Thickness Modifier**: 1.0 - Standard depth detection
- **Use Case**: Adds depth to corners, sculpture details, architectural features

#### Depth of Field (Focus Effects)
- **Mode**: Gaussian (better performance)
- **Start Distance**: 10 units
- **End Distance**: 30 units
- **Status**: Disabled by default (enable for cinematic moments)
- **Use Case**: Focus attention on specific artworks or characters

#### Vignette (Frame Darkening)
- **Intensity**: 0.25 - Subtle edge darkening
- **Smoothness**: 0.4 - Gradual transition
- **Color**: Black
- **Use Case**: Cinematic look, directs eye to center

### Customizing Per Scene:
1. Create additional Volume GameObjects (non-global)
2. Add **Box Collider** or **Sphere Collider** as trigger
3. Set different profiles for different gallery rooms
4. Adjust **Priority** (higher values override lower ones)

---

## 4. Set Up Lighting for Gallery Spaces

### Recommended Lighting Setup:

#### Main Light (Directional Light):
1. Create: **GameObject > Light > Directional Light**
2. Settings:
   - **Intensity**: 0.5 - 1.0 (gallery ambient)
   - **Color**: Warm white (255, 250, 245) or cool white (245, 250, 255)
   - **Shadow Type**: Soft Shadows
   - **Shadow Resolution**: Very High
   - **Mode**: Realtime (for dynamic) or Baked (for performance)

#### Spotlight for Artworks:
1. Create: **GameObject > Light > Spotlight**
2. Settings:
   - **Intensity**: 2.0 - 5.0 (focused on artwork)
   - **Range**: 10 - 20 units
   - **Spot Angle**: 30 - 45 degrees
   - **Color**: Neutral white (255, 255, 255)
   - **Shadow Type**: Soft Shadows
   - **Enable** in URP Asset: Additional Lights

#### Ambient Lighting:
1. Go to **Window > Rendering > Lighting**
2. In **Environment** tab:
   - **Skybox Material**: Default or custom HDRI
   - **Sun Source**: Assign your Directional Light
   - **Environment Lighting > Source**: Skybox
   - **Ambient Intensity**: 1.0
   - **Reflection Intensity**: 1.0

#### Point Lights (Accent Lighting):
- Use for lamps, decorative elements
- **Intensity**: 1.0 - 3.0
- **Range**: 5 - 15 units
- **Enable shadows** for important lights only (performance)

### Baked Lighting (For Static Gallery Spaces):
1. Mark static objects: Select objects > **Static** checkbox (top right of Inspector)
2. In **Lighting** window:
   - **Lighting Mode**: Baked Indirect or Shadowmask
   - **Lightmap Resolution**: 20 - 40 texels per unit
   - Click **Generate Lighting**
3. Benefits:
   - Better performance
   - More realistic shadows
   - Global illumination

### Real-time Lighting (For Dynamic Spaces):
- Use for areas with moving objects or characters
- Enable **Realtime Global Illumination** in Lighting settings
- More expensive but fully dynamic

---

## 5. Configure Quality Settings

### Quality Levels Setup:
1. Go to **Edit > Project Settings > Quality**
2. Configure levels:

#### Ultra Quality (High-end PCs):
- **URP Asset**: MetaverseURP-HighQuality
- **Anti Aliasing**: 4x MSAA
- **Shadows**: Very High Resolution (2048)
- **Shadow Cascades**: 4
- **Texture Quality**: Full Res
- **VSync**: On

#### High Quality (Mid-range PCs):
- **URP Asset**: MetaverseURP-HighQuality
- **Anti Aliasing**: 2x MSAA
- **Shadows**: High Resolution (2048)
- **Shadow Cascades**: 4
- **Texture Quality**: Full Res
- **VSync**: On

#### Medium Quality (VR/Lower-end):
- **URP Asset**: MetaverseURP-MediumQuality
- **Anti Aliasing**: 2x MSAA
- **Shadows**: Medium Resolution (1024)
- **Shadow Cascades**: 2
- **Texture Quality**: Half Res
- **VSync**: Off (for VR)

#### Low Quality (Mobile/Web):
- **URP Asset**: MetaverseURP-MediumQuality
- **Anti Aliasing**: Off
- **Shadows**: Low Resolution (512)
- **Shadow Cascades**: 1
- **Texture Quality**: Quarter Res
- **VSync**: Off

### Set Default Quality:
- **Edit > Project Settings > Quality**
- Set **Default** to **High** for PC builds
- Set platform-specific defaults in the quality grid

---

## 6. URP Asset Configuration Details

### MetaverseURP-HighQuality Features:
- **HDR**: Enabled (better lighting range)
- **MSAA**: 4x (smooth edges)
- **Render Scale**: 1.0 (full resolution)
- **Depth Texture**: Enabled (for post-processing)
- **Main Light**: Per-Pixel with shadows
- **Additional Lights**: Up to 8 per object
- **Shadow Distance**: 150 units
- **Shadow Cascades**: 4 (better shadow quality at distance)
- **SRP Batcher**: Enabled (performance optimization)

### MetaverseURP-MediumQuality Features:
- **HDR**: Enabled
- **MSAA**: 2x
- **Render Scale**: 1.0
- **Depth Texture**: Enabled
- **Main Light**: Per-Pixel with shadows
- **Additional Lights**: Up to 4 per object
- **Shadow Distance**: 100 units
- **Shadow Cascades**: 2
- **SRP Batcher**: Enabled

---

## 7. Performance Optimization Tips

### For Gallery Spaces:
1. **Use Occlusion Culling**:
   - Window > Rendering > Occlusion Culling
   - Bake occlusion data for gallery rooms

2. **LOD Groups**:
   - Add LOD Group to detailed objects
   - Create lower-poly versions for distance viewing

3. **Light Baking**:
   - Bake lighting for static gallery architecture
   - Use mixed lighting mode for best balance

4. **Texture Atlasing**:
   - Combine similar materials into atlases
   - Reduces draw calls

5. **Reduce Real-time Lights**:
   - Maximum 8 additional lights per object (High Quality)
   - Use baked lighting where possible
   - Consider light probes for dynamic objects

6. **Post-Processing**:
   - Disable Depth of Field when not needed
   - Reduce Ambient Occlusion intensity on mobile

---

## 8. Testing and Troubleshooting

### Common Issues:

#### Materials are Pink:
- **Cause**: Materials still using Built-in RP shaders
- **Solution**: Convert materials to URP shaders (see Section 2)

#### Performance is Low:
- **Cause**: Too many real-time lights or high shadow resolution
- **Solution**: 
  - Switch to Medium Quality URP asset
  - Reduce shadow distance
  - Use baked lighting
  - Reduce Additional Lights Per Object

#### Post-Processing Not Working:
- **Cause**: No Global Volume or missing profile
- **Solution**: 
  - Add Global Volume GameObject
  - Assign MetaversePostProcessing profile
  - Ensure camera has "Post Processing" enabled (default in URP)

#### Shadows Look Blocky:
- **Cause**: Low shadow resolution
- **Solution**: 
  - Increase Main Light Shadow Resolution
  - Increase Shadow Cascades
  - Adjust Shadow Bias values

#### Scene is Too Dark/Bright:
- **Solution**:
  - Adjust Directional Light intensity
  - Modify Post Exposure in Color Grading
  - Check Environment Lighting settings
  - Ensure Skybox is assigned

---

## 9. Gallery-Specific Recommendations

### Artwork Presentation:
1. **Spotlights on Each Artwork**:
   - Position 2-3 units above and in front
   - Angle 30-45 degrees down
   - Intensity 3-5
   - Enable soft shadows

2. **Wall Lighting**:
   - Use Point Lights or Area Lights (if using Light Cookies)
   - Low intensity (0.5-1.0)
   - Baked for performance

3. **Floor Reflections**:
   - Enable Reflection Probes in gallery rooms
   - Use Planar Reflection (URP Renderer Feature) for polished floors
   - Box Projection for accurate reflections

### Atmospheric Effects:
1. **Volume Fog** (optional):
   - Add URP Renderer Feature for fog
   - Subtle effect for depth

2. **Light Shafts**:
   - Use Volumetric Lighting Renderer Feature
   - Great for windows and dramatic lighting

3. **Color Zones**:
   - Different Color Grading per gallery room
   - Use local volumes with Box Colliders

---

## 10. Next Steps

1. **Assign URP Asset** in Project Settings (Section 1)
2. **Convert Materials** to URP shaders (Section 2)
3. **Add Global Volume** with post-processing (Section 3)
4. **Set up Lighting** for your gallery spaces (Section 4)
5. **Test on Target Devices** and adjust quality settings
6. **Optimize** based on performance metrics

---

## Additional Resources

### Unity Documentation:
- [URP Overview](https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@12.1/manual/index.html)
- [Post-processing in URP](https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@12.1/manual/post-processing.html)
- [Lighting in URP](https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@12.1/manual/lighting.html)

### Performance Profiling:
- Window > Analysis > Profiler (Rendering module)
- Window > Analysis > Frame Debugger
- Statistics panel in Game View

---

## File Structure

```
Assets/Settings/URP/
├── MetaverseURP-HighQuality.asset          (Main URP asset for high-end)
├── MetaverseURP-MediumQuality.asset        (URP asset for mid-range)
├── MetaverseForwardRenderer.asset           (Renderer configuration)
├── MetaversePostProcessing.asset            (Post-processing profile)
└── URP-SETUP-GUIDE.md                       (This guide)
```

---

## Support

If you encounter issues:
1. Check Unity Console for errors
2. Verify all asset references are assigned
3. Ensure URP package version matches (12.1.8)
4. Review URP asset settings in Inspector
5. Test with a simple scene first

---

**Created for Unity 2021.3.9f1 | URP 12.1.8**
**Last Updated: July 9, 2026**
