using UnityEngine;

namespace Metaverse.Rendering
{
    /// <summary>
    /// Manages lighting presets for gallery spaces
    /// Attach to a GameObject in your gallery scene to easily configure lighting
    /// </summary>
    public class GalleryLightingManager : MonoBehaviour
    {
        [Header("Main Lighting")]
        [Tooltip("The main directional light (sun/ambient)")]
        public Light directionalLight;

        [Header("Lighting Presets")]
        [Range(0f, 2f)]
        [Tooltip("Overall scene brightness multiplier")]
        public float globalIntensityMultiplier = 1f;

        [Header("Ambient Settings")]
        [Range(0f, 1f)]
        public float ambientIntensity = 0.5f;

        [ColorUsage(false)]
        public Color ambientColor = new Color(0.9f, 0.9f, 0.95f);

        [Header("Gallery Presets")]
        public LightingPreset currentPreset = LightingPreset.NaturalDaylight;

        private LightingPreset lastPreset;

        // Lighting preset definitions
        public enum LightingPreset
        {
            NaturalDaylight,    // Bright, neutral white, simulates daylight
            WarmGallery,        // Warm tones, cozy atmosphere
            CoolModern,         // Cool tones, modern/clinical feel
            DramaticSpotlight,  // High contrast, focused lighting
            EveningAmbient,     // Soft, dim, evening mood
            Custom              // User-defined settings
        }

        void Start()
        {
            if (directionalLight == null)
            {
                directionalLight = FindObjectOfType<Light>();
                if (directionalLight != null && directionalLight.type != LightType.Directional)
                {
                    Debug.LogWarning("GalleryLightingManager: Found light is not directional. Please assign the main directional light.");
                    directionalLight = null;
                }
            }

            ApplyPreset(currentPreset);
            lastPreset = currentPreset;
        }

        void Update()
        {
            // Check if preset changed in inspector
            if (currentPreset != lastPreset)
            {
                ApplyPreset(currentPreset);
                lastPreset = currentPreset;
            }

            // Update ambient lighting
            RenderSettings.ambientLight = ambientColor;
            RenderSettings.ambientIntensity = ambientIntensity;
        }

        /// <summary>
        /// Apply a lighting preset to the scene
        /// </summary>
        public void ApplyPreset(LightingPreset preset)
        {
            if (directionalLight == null)
            {
                Debug.LogWarning("GalleryLightingManager: No directional light assigned!");
                return;
            }

            switch (preset)
            {
                case LightingPreset.NaturalDaylight:
                    SetNaturalDaylightPreset();
                    break;

                case LightingPreset.WarmGallery:
                    SetWarmGalleryPreset();
                    break;

                case LightingPreset.CoolModern:
                    SetCoolModernPreset();
                    break;

                case LightingPreset.DramaticSpotlight:
                    SetDramaticSpotlightPreset();
                    break;

                case LightingPreset.EveningAmbient:
                    SetEveningAmbientPreset();
                    break;

                case LightingPreset.Custom:
                    // Don't change anything, user controls manually
                    Debug.Log("GalleryLightingManager: Custom preset - adjust values manually");
                    break;
            }

            Debug.Log($"GalleryLightingManager: Applied {preset} preset");
        }

        void SetNaturalDaylightPreset()
        {
            // Bright, neutral white light simulating daylight
            directionalLight.intensity = 1.0f * globalIntensityMultiplier;
            directionalLight.color = new Color(1f, 0.98f, 0.96f); // Slightly warm white
            directionalLight.colorTemperature = 6500f; // Daylight temperature

            ambientColor = new Color(0.75f, 0.8f, 0.85f); // Slightly cool ambient
            ambientIntensity = 0.6f;

            RenderSettings.reflectionIntensity = 1.0f;
        }

        void SetWarmGalleryPreset()
        {
            // Warm tones for cozy, inviting atmosphere
            directionalLight.intensity = 0.8f * globalIntensityMultiplier;
            directionalLight.color = new Color(1f, 0.95f, 0.85f); // Warm white
            directionalLight.colorTemperature = 3000f; // Warm temperature

            ambientColor = new Color(0.95f, 0.85f, 0.7f); // Warm amber ambient
            ambientIntensity = 0.5f;

            RenderSettings.reflectionIntensity = 0.8f;
        }

        void SetCoolModernPreset()
        {
            // Cool tones for modern, clinical feel
            directionalLight.intensity = 0.9f * globalIntensityMultiplier;
            directionalLight.color = new Color(0.95f, 0.98f, 1f); // Cool white
            directionalLight.colorTemperature = 8000f; // Cool temperature

            ambientColor = new Color(0.7f, 0.75f, 0.85f); // Cool blue ambient
            ambientIntensity = 0.5f;

            RenderSettings.reflectionIntensity = 1.2f;
        }

        void SetDramaticSpotlightPreset()
        {
            // High contrast with low ambient for dramatic effect
            directionalLight.intensity = 0.4f * globalIntensityMultiplier;
            directionalLight.color = new Color(1f, 0.98f, 0.96f); // Neutral white
            directionalLight.colorTemperature = 6500f;

            ambientColor = new Color(0.2f, 0.2f, 0.25f); // Very dark ambient
            ambientIntensity = 0.2f;

            RenderSettings.reflectionIntensity = 0.5f;
        }

        void SetEveningAmbientPreset()
        {
            // Soft, dim lighting for evening/night mood
            directionalLight.intensity = 0.3f * globalIntensityMultiplier;
            directionalLight.color = new Color(1f, 0.9f, 0.75f); // Warm orange
            directionalLight.colorTemperature = 2500f; // Very warm temperature

            ambientColor = new Color(0.4f, 0.35f, 0.45f); // Purple-ish dark ambient
            ambientIntensity = 0.3f;

            RenderSettings.reflectionIntensity = 0.4f;
        }

        /// <summary>
        /// Create a spotlight focused on a specific point (artwork)
        /// Call this from code to create spotlights dynamically
        /// </summary>
        public GameObject CreateArtworkSpotlight(Vector3 targetPosition, string artworkName = "Artwork")
        {
            GameObject spotlightGO = new GameObject($"Spotlight - {artworkName}");
            Light spotlight = spotlightGO.AddComponent<Light>();

            // Configure spotlight
            spotlight.type = LightType.Spot;
            spotlight.intensity = 3f * globalIntensityMultiplier;
            spotlight.range = 15f;
            spotlight.spotAngle = 40f;
            spotlight.color = Color.white;
            spotlight.shadows = LightShadows.Soft;
            spotlight.shadowStrength = 0.8f;

            // Position spotlight above and in front of target
            Vector3 spotlightPosition = targetPosition + new Vector3(0, 3, 2);
            spotlightGO.transform.position = spotlightPosition;

            // Point at target
            spotlightGO.transform.LookAt(targetPosition);

            Debug.Log($"GalleryLightingManager: Created spotlight for {artworkName}");
            return spotlightGO;
        }

        /// <summary>
        /// Adjust all spotlight intensities in the scene
        /// Useful for batch adjustments
        /// </summary>
        public void AdjustAllSpotlights(float intensityMultiplier)
        {
            Light[] allLights = FindObjectsOfType<Light>();
            int count = 0;

            foreach (Light light in allLights)
            {
                if (light.type == LightType.Spot)
                {
                    light.intensity *= intensityMultiplier;
                    count++;
                }
            }

            Debug.Log($"GalleryLightingManager: Adjusted {count} spotlights by {intensityMultiplier}x");
        }

        /// <summary>
        /// Enable or disable all spotlights in the scene
        /// </summary>
        public void ToggleSpotlights(bool enabled)
        {
            Light[] allLights = FindObjectsOfType<Light>();
            int count = 0;

            foreach (Light light in allLights)
            {
                if (light.type == LightType.Spot)
                {
                    light.enabled = enabled;
                    count++;
                }
            }

            Debug.Log($"GalleryLightingManager: {(enabled ? "Enabled" : "Disabled")} {count} spotlights");
        }

        /// <summary>
        /// Set time of day (0-24 hours) for dynamic lighting
        /// </summary>
        public void SetTimeOfDay(float hour)
        {
            if (directionalLight == null) return;

            // Clamp hour to 0-24
            hour = Mathf.Clamp(hour, 0f, 24f);

            // Calculate sun rotation (simplified)
            float angle = (hour / 24f) * 360f - 90f; // -90 to start at sunrise
            directionalLight.transform.rotation = Quaternion.Euler(angle, 170f, 0f);

            // Adjust intensity based on time
            float intensity;
            Color lightColor;

            if (hour < 6f || hour > 20f)
            {
                // Night (6PM - 6AM)
                intensity = 0.1f;
                lightColor = new Color(0.7f, 0.7f, 0.9f); // Cool night color
                ambientIntensity = 0.1f;
            }
            else if (hour < 8f)
            {
                // Sunrise (6AM - 8AM)
                float t = (hour - 6f) / 2f;
                intensity = Mathf.Lerp(0.1f, 1f, t);
                lightColor = Color.Lerp(new Color(1f, 0.7f, 0.5f), new Color(1f, 0.98f, 0.96f), t);
                ambientIntensity = Mathf.Lerp(0.1f, 0.5f, t);
            }
            else if (hour > 18f)
            {
                // Sunset (6PM - 8PM)
                float t = (hour - 18f) / 2f;
                intensity = Mathf.Lerp(1f, 0.1f, t);
                lightColor = Color.Lerp(new Color(1f, 0.98f, 0.96f), new Color(1f, 0.6f, 0.4f), t);
                ambientIntensity = Mathf.Lerp(0.5f, 0.1f, t);
            }
            else
            {
                // Daytime (8AM - 6PM)
                intensity = 1f;
                lightColor = new Color(1f, 0.98f, 0.96f);
                ambientIntensity = 0.5f;
            }

            directionalLight.intensity = intensity * globalIntensityMultiplier;
            directionalLight.color = lightColor;

            Debug.Log($"GalleryLightingManager: Set time to {hour:F1}:00");
        }

#if UNITY_EDITOR
        [Header("Debug")]
        [Tooltip("Show gizmos for lights")]
        public bool showGizmos = true;

        void OnDrawGizmos()
        {
            if (!showGizmos) return;

            // Draw directional light direction
            if (directionalLight != null)
            {
                Gizmos.color = directionalLight.color;
                Vector3 pos = directionalLight.transform.position;
                Vector3 dir = directionalLight.transform.forward * 5f;
                Gizmos.DrawRay(pos, dir);
                Gizmos.DrawWireSphere(pos, 0.5f);
            }
        }
#endif
    }
}
