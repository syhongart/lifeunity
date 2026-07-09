# URP Quick Start Guide

Get your metaverse gallery up and running with URP in 10 minutes.

## Prerequisites
- Unity 2021.3.9f1 installed
- Project opened in Unity Editor
- URP package 12.1.8 (already in manifest.json)

---

## Step-by-Step Setup (10 Minutes)

### Step 1: Assign URP Asset (2 minutes)
1. Open Unity Editor
2. **Edit > Project Settings > Graphics**
3. Find **Scriptable Render Pipeline Settings**
4. Click the circle icon on the right
5. Search for **MetaverseURP-HighQuality**
6. Select it and close

**Verify**: Scene view should reload with better lighting

---

### Step 2: Convert Materials (3 minutes)
1. **Edit > Render Pipeline > Universal Render Pipeline**
2. Click **Upgrade Project Materials to URP Materials**
3. In the dialog, click **Proceed**
4. Wait for conversion (may take 1-2 minutes)

**Verify**: Pink materials should now look normal

---

### Step 3: Add Post-Processing (2 minutes)
1. In Hierarchy window, right-click
2. **Volume > Global Volume**
3. Name it "Global Post Processing"
4. In Inspector, check these settings:
   - ✓ **Is Global** (checked)
   - **Priority**: 0
5. Click the **Profile** dropdown (New button)
6. Instead, click the circle icon
7. Search for **MetaversePostProcessing**
8. Select it

**Verify**: Scene should have subtle bloom and vignette effects

---

### Step 4: Set Up Main Light (2 minutes)
1. In Hierarchy, find your **Directional Light** (or create one: GameObject > Light > Directional Light)
2. In Inspector, set:
   - **Intensity**: 0.8 - 1.0
   - **Color**: White (255, 255, 255)
   - **Shadow Type**: Soft Shadows
   - **Mode**: Realtime

**Verify**: Scene should be well-lit with soft shadows

---

### Step 5: Add Helper Scripts (1 minute - Optional)
1. In Hierarchy, create empty GameObject: **GameObject > Create Empty**
2. Name it "URP Manager"
3. In Inspector, click **Add Component**
4. Search for **URPSetupHelper**
5. Add it
6. Also add **GalleryLightingManager**
7. Assign the **Directional Light** to the GalleryLightingManager

**Verify**: You can now adjust post-processing in real-time

---

## Done! Test Your Setup

### Test Checklist:
- [ ] Scene has good lighting
- [ ] No pink materials (all converted to URP)
- [ ] Bloom effect visible on bright areas
- [ ] Soft shadows under objects
- [ ] Vignette darkens edges slightly
- [ ] Performance is smooth (check Stats in Game view)

---

## Next Steps

### For Better Quality:
1. **Add Spotlights** to artworks:
   - GameObject > Light > Spotlight
   - Position above artwork
   - Intensity: 3-5
   - Spot Angle: 30-40

2. **Bake Lighting** for performance:
   - Window > Rendering > Lighting
   - Generate Lighting

3. **Add Reflection Probes**:
   - GameObject > Light > Reflection Probe
   - Position in gallery rooms

### For Better Performance:
1. Switch to Medium Quality URP asset:
   - Edit > Project Settings > Graphics
   - Use **MetaverseURP-MediumQuality**

2. Reduce shadow distance:
   - Select URP asset in Project window
   - Inspector > Shadows > Distance: 50-100

3. Disable Ambient Occlusion:
   - Select Global Volume
   - In MetaversePostProcessing profile
   - Disable AO

---

## Troubleshooting

### Materials Still Pink?
- Run material conversion again (Step 2)
- Check shader is URP/Lit or URP/Simple Lit
- Some custom shaders may need manual updating

### Post-Processing Not Working?
- Make sure Global Volume has **Is Global** checked
- Verify MetaversePostProcessing profile is assigned
- Check Camera has post-processing enabled (should be automatic)

### Performance is Slow?
- Switch to MetaverseURP-MediumQuality
- Reduce shadow resolution in URP asset
- Disable Ambient Occlusion
- Use fewer real-time lights

### Scene Too Dark?
- Increase Directional Light intensity
- Adjust Post Exposure in Color Grading (Global Volume)
- Check Window > Rendering > Lighting > Environment settings

### Scene Too Bright?
- Reduce Directional Light intensity
- Lower Post Exposure in Color Grading
- Reduce Bloom intensity

---

## Keyboard Shortcuts (In Unity)

- **Ctrl + 7**: Lighting window
- **Ctrl + 0**: Inspector
- **Ctrl + 9**: Animation window
- **F**: Focus on selected object
- **Alt + Click**: Orbit around object

---

## Quick Settings Access

### During Play Mode:
1. Select "URP Manager" GameObject in Hierarchy
2. In Inspector, adjust:
   - Bloom Intensity slider
   - Vignette Intensity slider
   - Enable/disable effects checkboxes
3. Changes happen in real-time

### Quality Presets:
In URPSetupHelper component, you can call:
- `SetQualityPreset(0)` - Low
- `SetQualityPreset(1)` - Medium  
- `SetQualityPreset(2)` - High
- `SetQualityPreset(3)` - Ultra

### Lighting Presets:
In GalleryLightingManager component, select:
- Natural Daylight
- Warm Gallery
- Cool Modern
- Dramatic Spotlight
- Evening Ambient
- Custom

---

## Files You Created

```
Assets/Settings/URP/
├── MetaverseURP-HighQuality.asset       ← Main URP settings
├── MetaverseURP-MediumQuality.asset     ← Performance settings
├── MetaverseForwardRenderer.asset       ← Renderer config
├── MetaversePostProcessing.asset        ← Visual effects
├── URPSetupHelper.cs                    ← Helper script
├── GalleryLightingManager.cs            ← Lighting presets
├── URP-SETUP-GUIDE.md                   ← Full documentation
├── QUICK-START.md                       ← This file
└── README.md                            ← Overview
```

---

## Need More Help?

1. **Full Documentation**: Read `URP-SETUP-GUIDE.md`
2. **Unity Docs**: [URP Manual](https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@12.1/manual/index.html)
3. **Debug Tools**: Window > Analysis > Frame Debugger
4. **Performance**: Window > Analysis > Profiler

---

## Tips for Gallery Spaces

1. **One Spotlight Per Artwork**
   - Creates professional gallery feel
   - Use soft shadows
   - Intensity: 3-5

2. **Use Warm Color Temperature**
   - Makes art more inviting
   - 3000K - 4000K range
   - Adjustable in GalleryLightingManager

3. **Bake Static Lighting**
   - Gallery walls/floor don't move
   - Much better performance
   - Still looks great

4. **Add Reflection Probes**
   - Makes materials look realistic
   - One per room is enough
   - Set to "Baked" for performance

5. **Test on Target Platform**
   - VR needs better performance
   - Desktop can handle Ultra quality
   - Web needs Medium/Low quality

---

**You're all set!** Your gallery now has professional-quality rendering with URP.

For advanced features, check `URP-SETUP-GUIDE.md`.

---

**Version**: 1.0  
**Unity**: 2021.3.9f1  
**URP**: 12.1.8  
**Last Updated**: July 9, 2026
