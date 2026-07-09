using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

#if UNITY_EDITOR
using UnityEditor;
#endif

namespace Metaverse.Rendering
{
    /// <summary>
    /// Helper script for URP setup and configuration
    /// Attach this to a GameObject in your scene for easy access to URP utilities
    /// </summary>
    public class URPSetupHelper : MonoBehaviour
    {
        [Header("Post-Processing Profile")]
        [Tooltip("Assign the MetaversePostProcessing profile here")]
        public VolumeProfile postProcessingProfile;

        [Header("Quality Settings")]
        [Range(0f, 1f)]
        [Tooltip("Adjust bloom intensity at runtime")]
        public float bloomIntensity = 0.5f;

        [Range(0f, 1f)]
        [Tooltip("Adjust vignette intensity at runtime")]
        public float vignetteIntensity = 0.25f;

        [Range(0f, 1f)]
        [Tooltip("Adjust ambient occlusion intensity at runtime")]
        public float ambientOcclusionIntensity = 0.5f;

        [Header("Runtime Controls")]
        [Tooltip("Enable/disable depth of field effect")]
        public bool enableDepthOfField = false;

        [Tooltip("Enable/disable bloom effect")]
        public bool enableBloom = true;

        [Tooltip("Enable/disable vignette effect")]
        public bool enableVignette = true;

        [Tooltip("Enable/disable ambient occlusion")]
        public bool enableAmbientOcclusion = true;

        private Bloom bloom;
        private Vignette vignette;
        private AmbientOcclusion ambientOcclusion;
        private DepthOfField depthOfField;
        private ColorAdjustments colorAdjustments;
        private Volume globalVolume;

        void Start()
        {
            InitializePostProcessing();
        }

        void Update()
        {
            if (postProcessingProfile != null)
            {
                UpdatePostProcessingEffects();
            }
        }

        /// <summary>
        /// Initialize post-processing components
        /// </summary>
        void InitializePostProcessing()
        {
            // Try to find existing global volume
            globalVolume = FindObjectOfType<Volume>();

            if (globalVolume == null)
            {
                Debug.LogWarning("URPSetupHelper: No Global Volume found in scene. Creating one...");
                CreateGlobalVolume();
            }

            if (globalVolume != null && globalVolume.profile != null)
            {
                // Get references to post-processing effects
                globalVolume.profile.TryGet(out bloom);
                globalVolume.profile.TryGet(out vignette);
                globalVolume.profile.TryGet(out ambientOcclusion);
                globalVolume.profile.TryGet(out depthOfField);
                globalVolume.profile.TryGet(out colorAdjustments);

                Debug.Log("URPSetupHelper: Post-processing effects initialized");
            }
        }

        /// <summary>
        /// Update post-processing effects based on inspector values
        /// </summary>
        void UpdatePostProcessingEffects()
        {
            // Update Bloom
            if (bloom != null)
            {
                bloom.active = enableBloom;
                if (bloom.intensity.overrideState)
                {
                    bloom.intensity.value = bloomIntensity;
                }
            }

            // Update Vignette
            if (vignette != null)
            {
                vignette.active = enableVignette;
                if (vignette.intensity.overrideState)
                {
                    vignette.intensity.value = vignetteIntensity;
                }
            }

            // Update Ambient Occlusion
            if (ambientOcclusion != null)
            {
                ambientOcclusion.active = enableAmbientOcclusion;
                if (ambientOcclusion.intensity.overrideState)
                {
                    ambientOcclusion.intensity.value = ambientOcclusionIntensity;
                }
            }

            // Update Depth of Field
            if (depthOfField != null)
            {
                depthOfField.active = enableDepthOfField;
            }
        }

        /// <summary>
        /// Create a global volume GameObject if one doesn't exist
        /// </summary>
        void CreateGlobalVolume()
        {
            GameObject volumeGO = new GameObject("Global Volume");
            globalVolume = volumeGO.AddComponent<Volume>();
            globalVolume.isGlobal = true;
            globalVolume.priority = 0;

            if (postProcessingProfile != null)
            {
                globalVolume.profile = postProcessingProfile;
                Debug.Log("URPSetupHelper: Created Global Volume with MetaversePostProcessing profile");
            }
            else
            {
                Debug.LogWarning("URPSetupHelper: Global Volume created but no profile assigned. Please assign MetaversePostProcessing profile in inspector.");
            }
        }

        /// <summary>
        /// Set quality preset for different performance levels
        /// </summary>
        /// <param name="preset">Quality preset (0=Low, 1=Medium, 2=High, 3=Ultra)</param>
        public void SetQualityPreset(int preset)
        {
            switch (preset)
            {
                case 0: // Low Quality
                    bloomIntensity = 0.3f;
                    vignetteIntensity = 0.15f;
                    ambientOcclusionIntensity = 0.3f;
                    enableBloom = false;
                    enableAmbientOcclusion = false;
                    enableDepthOfField = false;
                    Debug.Log("URPSetupHelper: Set to Low Quality");
                    break;

                case 1: // Medium Quality
                    bloomIntensity = 0.4f;
                    vignetteIntensity = 0.2f;
                    ambientOcclusionIntensity = 0.4f;
                    enableBloom = true;
                    enableAmbientOcclusion = false;
                    enableDepthOfField = false;
                    Debug.Log("URPSetupHelper: Set to Medium Quality");
                    break;

                case 2: // High Quality
                    bloomIntensity = 0.5f;
                    vignetteIntensity = 0.25f;
                    ambientOcclusionIntensity = 0.5f;
                    enableBloom = true;
                    enableAmbientOcclusion = true;
                    enableDepthOfField = false;
                    Debug.Log("URPSetupHelper: Set to High Quality");
                    break;

                case 3: // Ultra Quality
                    bloomIntensity = 0.6f;
                    vignetteIntensity = 0.3f;
                    ambientOcclusionIntensity = 0.6f;
                    enableBloom = true;
                    enableAmbientOcclusion = true;
                    enableDepthOfField = false;
                    Debug.Log("URPSetupHelper: Set to Ultra Quality");
                    break;
            }
        }

        /// <summary>
        /// Toggle bloom effect on/off
        /// </summary>
        public void ToggleBloom()
        {
            enableBloom = !enableBloom;
        }

        /// <summary>
        /// Toggle vignette effect on/off
        /// </summary>
        public void ToggleVignette()
        {
            enableVignette = !enableVignette;
        }

        /// <summary>
        /// Toggle ambient occlusion on/off
        /// </summary>
        public void ToggleAmbientOcclusion()
        {
            enableAmbientOcclusion = !enableAmbientOcclusion;
        }

        /// <summary>
        /// Toggle depth of field on/off
        /// </summary>
        public void ToggleDepthOfField()
        {
            enableDepthOfField = !enableDepthOfField;
        }

        /// <summary>
        /// Adjust color grading mood (0=Cool, 0.5=Neutral, 1=Warm)
        /// </summary>
        public void SetColorMood(float mood)
        {
            if (colorAdjustments != null && colorAdjustments.colorFilter.overrideState)
            {
                // Interpolate between cool blue and warm orange tints
                Color coolColor = new Color(0.9f, 0.95f, 1f, 1f); // Cool blue tint
                Color warmColor = new Color(1f, 0.95f, 0.9f, 1f); // Warm orange tint
                colorAdjustments.colorFilter.value = Color.Lerp(coolColor, warmColor, mood);
            }
        }

#if UNITY_EDITOR
        [Header("Editor Tools")]
        [Tooltip("Click to check URP setup in Editor")]
        public bool checkSetup = false;

        void OnValidate()
        {
            if (checkSetup)
            {
                checkSetup = false;
                CheckURPSetup();
            }
        }

        /// <summary>
        /// Check if URP is properly configured (Editor only)
        /// </summary>
        void CheckURPSetup()
        {
            Debug.Log("=== URP Setup Check ===");

            // Check if URP is assigned in Graphics Settings
            var currentPipeline = GraphicsSettings.currentRenderPipeline;
            if (currentPipeline != null)
            {
                Debug.Log($"✓ URP Asset assigned: {currentPipeline.name}");
            }
            else
            {
                Debug.LogError("✗ No Render Pipeline Asset assigned in Graphics Settings!");
                Debug.LogError("  Fix: Edit > Project Settings > Graphics > Scriptable Render Pipeline Settings");
            }

            // Check for Global Volume
            var volumes = FindObjectsOfType<Volume>();
            bool hasGlobalVolume = false;
            foreach (var vol in volumes)
            {
                if (vol.isGlobal)
                {
                    hasGlobalVolume = true;
                    Debug.Log($"✓ Global Volume found: {vol.gameObject.name}");
                    if (vol.profile != null)
                    {
                        Debug.Log($"  Profile: {vol.profile.name}");
                    }
                    else
                    {
                        Debug.LogWarning("  ⚠ No profile assigned to Global Volume!");
                    }
                }
            }

            if (!hasGlobalVolume)
            {
                Debug.LogWarning("⚠ No Global Volume found in scene");
                Debug.Log("  Add: GameObject > Volume > Global Volume");
            }

            // Check camera
            var camera = Camera.main;
            if (camera != null)
            {
                var cameraData = camera.GetComponent<UniversalAdditionalCameraData>();
                if (cameraData != null)
                {
                    Debug.Log($"✓ Main Camera has URP camera data");
                    Debug.Log($"  Render Type: {cameraData.renderType}");
                    Debug.Log($"  Post-Processing: {cameraData.renderPostProcessing}");
                }
                else
                {
                    Debug.LogWarning("⚠ Main Camera missing Universal Additional Camera Data");
                }
            }

            Debug.Log("=== Setup Check Complete ===");
        }
#endif
    }
}
