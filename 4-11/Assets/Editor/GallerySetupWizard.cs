using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;

namespace Metaverse.Editor
{
    /// <summary>
    /// 갤러리 자동 설정 마법사
    /// 원클릭으로 프로페셔널 조명과 머티리얼 설정
    /// </summary>
    public class GallerySetupWizard : EditorWindow
    {
        private enum GalleryStyle
        {
            WarmGallery,      // 따뜻한 갤러리 (황금빛)
            CoolModern,       // 차가운 현대식 (백색광)
            NaturalDaylight,  // 자연광 (햇빛)
            DramaticSpot,     // 극적 (스포트라이트 강조)
            EveningAmbient    // 저녁 분위기
        }

        private GalleryStyle selectedStyle = GalleryStyle.WarmGallery;
        private bool createFloor = true;
        private bool createWalls = true;
        private bool createCeiling = true;
        private bool setupLighting = true;
        private bool setupPostProcessing = true;
        private bool setupReflections = true;

        private float roomWidth = 15f;
        private float roomLength = 15f;
        private float roomHeight = 4f;
        private float wallThickness = 0.3f;

        [MenuItem("Metaverse/Gallery Setup Wizard 🎨")]
        public static void ShowWindow()
        {
            GallerySetupWizard window = GetWindow<GallerySetupWizard>("Gallery Setup");
            window.minSize = new Vector2(400, 600);
            window.Show();
        }

        private void OnGUI()
        {
            GUILayout.Label("🎨 갤러리 자동 설정 마법사", EditorStyles.boldLabel);
            EditorGUILayout.HelpBox(
                "원클릭으로 프로페셔널 갤러리를 생성합니다.\n" +
                "조명, 머티리얼, 포스트 프로세싱 모두 자동 설정!",
                MessageType.Info
            );

            GUILayout.Space(10);

            // 스타일 선택
            GUILayout.Label("갤러리 스타일", EditorStyles.boldLabel);
            selectedStyle = (GalleryStyle)EditorGUILayout.EnumPopup("스타일:", selectedStyle);

            EditorGUILayout.HelpBox(GetStyleDescription(), MessageType.None);

            GUILayout.Space(10);

            // 방 크기
            GUILayout.Label("방 크기", EditorStyles.boldLabel);
            roomWidth = EditorGUILayout.FloatField("폭 (m):", roomWidth);
            roomLength = EditorGUILayout.FloatField("길이 (m):", roomLength);
            roomHeight = EditorGUILayout.FloatField("높이 (m):", roomHeight);
            wallThickness = EditorGUILayout.FloatField("벽 두께 (m):", wallThickness);

            GUILayout.Space(10);

            // 옵션
            GUILayout.Label("생성할 요소", EditorStyles.boldLabel);
            createFloor = EditorGUILayout.Toggle("바닥", createFloor);
            createWalls = EditorGUILayout.Toggle("벽", createWalls);
            createCeiling = EditorGUILayout.Toggle("천장", createCeiling);
            setupLighting = EditorGUILayout.Toggle("조명 설정", setupLighting);
            setupPostProcessing = EditorGUILayout.Toggle("포스트 프로세싱", setupPostProcessing);
            setupReflections = EditorGUILayout.Toggle("반사 프로브", setupReflections);

            GUILayout.Space(20);

            // 생성 버튼
            if (GUILayout.Button("✨ 갤러리 생성하기", GUILayout.Height(50)))
            {
                CreateGallery();
            }

            GUILayout.Space(10);

            EditorGUILayout.HelpBox(
                "팁:\n" +
                "• 생성 후 조명은 'Bake' 필요 (Window > Rendering > Lighting > Generate Lighting)\n" +
                "• 고품질 텍스처는 polyhaven.com에서 무료 다운로드\n" +
                "• 작품 배치 후 'GalleryLightingManager'로 스포트라이트 자동 생성",
                MessageType.Info
            );
        }

        private string GetStyleDescription()
        {
            switch (selectedStyle)
            {
                case GalleryStyle.WarmGallery:
                    return "🟡 따뜻한 갤러리\n" +
                           "• 황금빛 조명 (2700K)\n" +
                           "• 아늑하고 고급스러운 분위기\n" +
                           "• 클래식 미술관 스타일";

                case GalleryStyle.CoolModern:
                    return "❄️ 차가운 현대식\n" +
                           "• 백색광 (5000K)\n" +
                           "• 깔끔하고 세련된 느낌\n" +
                           "• 현대 미술관 스타일";

                case GalleryStyle.NaturalDaylight:
                    return "☀️ 자연광\n" +
                           "• 햇빛 느낌 (5500K)\n" +
                           "• 밝고 생동감 있음\n" +
                           "• 낮 시간 분위기";

                case GalleryStyle.DramaticSpot:
                    return "🎭 극적 스포트라이트\n" +
                           "• 강한 명암 대비\n" +
                           "• 작품에 집중\n" +
                           "• 드라마틱한 연출";

                case GalleryStyle.EveningAmbient:
                    return "🌙 저녁 분위기\n" +
                           "• 은은한 조명 (3000K)\n" +
                           "• 편안하고 차분함\n" +
                           "• 저녁 갤러리 느낌";

                default:
                    return "";
            }
        }

        private void CreateGallery()
        {
            Debug.Log("[GallerySetup] 갤러리 생성 시작...");

            // 루트 오브젝트
            GameObject galleryRoot = new GameObject("Gallery");
            Undo.RegisterCreatedObjectUndo(galleryRoot, "Create Gallery");

            // 바닥
            if (createFloor)
            {
                CreateFloor(galleryRoot.transform);
            }

            // 벽
            if (createWalls)
            {
                CreateWalls(galleryRoot.transform);
            }

            // 천장
            if (createCeiling)
            {
                CreateCeiling(galleryRoot.transform);
            }

            // 조명
            if (setupLighting)
            {
                SetupLighting(galleryRoot.transform);
            }

            // 반사
            if (setupReflections)
            {
                SetupReflections(galleryRoot.transform);
            }

            // 포스트 프로세싱
            if (setupPostProcessing)
            {
                SetupPostProcessing();
            }

            Debug.Log("[GallerySetup] ✅ 갤러리 생성 완료!");

            EditorUtility.DisplayDialog(
                "갤러리 생성 완료!",
                "갤러리가 생성되었습니다.\n\n" +
                "다음 단계:\n" +
                "1. Window > Rendering > Lighting\n" +
                "2. Generate Lighting 클릭 (베이킹)\n" +
                "3. 작품(ArtworkFrame) 배치\n" +
                "4. GalleryLightingManager로 스포트라이트 자동 생성",
                "확인"
            );

            // 씬 저장 권장
            if (EditorUtility.DisplayDialog(
                "씬 저장",
                "씬을 저장하시겠습니까?",
                "저장",
                "나중에"))
            {
                EditorSceneManager.SaveOpenScenes();
            }
        }

        private void CreateFloor(Transform parent)
        {
            GameObject floor = GameObject.CreatePrimitive(PrimitiveType.Cube);
            floor.name = "Floor";
            floor.transform.SetParent(parent);
            floor.transform.localPosition = new Vector3(0, -0.05f, 0);
            floor.transform.localScale = new Vector3(roomWidth, 0.1f, roomLength);

            // 머티리얼
            Material floorMat = new Material(Shader.Find("Universal Render Pipeline/Lit"));
            floorMat.name = "FloorMaterial";
            floorMat.color = new Color(0.95f, 0.95f, 0.95f); // 밝은 회색
            floorMat.SetFloat("_Metallic", 0.0f);
            floorMat.SetFloat("_Smoothness", 0.6f); // 약간 광택

            floor.GetComponent<Renderer>().material = floorMat;

            // Static 설정 (Lightmap)
            GameObjectUtility.SetStaticEditorFlags(floor, StaticEditorFlags.ContributeGI);

            Debug.Log("[GallerySetup] 바닥 생성 완료");
        }

        private void CreateWalls(Transform parent)
        {
            // 4개 벽 생성
            CreateWall(parent, "WallNorth", new Vector3(0, roomHeight / 2, roomLength / 2), new Vector3(roomWidth, roomHeight, wallThickness));
            CreateWall(parent, "WallSouth", new Vector3(0, roomHeight / 2, -roomLength / 2), new Vector3(roomWidth, roomHeight, wallThickness));
            CreateWall(parent, "WallEast", new Vector3(roomWidth / 2, roomHeight / 2, 0), new Vector3(wallThickness, roomHeight, roomLength));
            CreateWall(parent, "WallWest", new Vector3(-roomWidth / 2, roomHeight / 2, 0), new Vector3(wallThickness, roomHeight, roomLength));

            Debug.Log("[GallerySetup] 벽 4개 생성 완료");
        }

        private void CreateWall(Transform parent, string name, Vector3 position, Vector3 scale)
        {
            GameObject wall = GameObject.CreatePrimitive(PrimitiveType.Cube);
            wall.name = name;
            wall.transform.SetParent(parent);
            wall.transform.localPosition = position;
            wall.transform.localScale = scale;

            // 머티리얼 (화이트 갤러리)
            Material wallMat = new Material(Shader.Find("Universal Render Pipeline/Lit"));
            wallMat.name = "WallMaterial";
            wallMat.color = Color.white;
            wallMat.SetFloat("_Metallic", 0.0f);
            wallMat.SetFloat("_Smoothness", 0.2f); // 약간 거친 표면

            wall.GetComponent<Renderer>().material = wallMat;

            // Static
            GameObjectUtility.SetStaticEditorFlags(wall, StaticEditorFlags.ContributeGI);
        }

        private void CreateCeiling(Transform parent)
        {
            GameObject ceiling = GameObject.CreatePrimitive(PrimitiveType.Cube);
            ceiling.name = "Ceiling";
            ceiling.transform.SetParent(parent);
            ceiling.transform.localPosition = new Vector3(0, roomHeight + 0.05f, 0);
            ceiling.transform.localScale = new Vector3(roomWidth, 0.1f, roomLength);

            // 머티리얼
            Material ceilingMat = new Material(Shader.Find("Universal Render Pipeline/Lit"));
            ceilingMat.name = "CeilingMaterial";
            ceilingMat.color = new Color(0.98f, 0.98f, 0.98f);
            ceilingMat.SetFloat("_Metallic", 0.0f);
            ceilingMat.SetFloat("_Smoothness", 0.2f);

            ceiling.GetComponent<Renderer>().material = ceilingMat;

            GameObjectUtility.SetStaticEditorFlags(ceiling, StaticEditorFlags.ContributeGI);

            Debug.Log("[GallerySetup] 천장 생성 완료");
        }

        private void SetupLighting(Transform parent)
        {
            GameObject lightingRoot = new GameObject("Lighting");
            lightingRoot.transform.SetParent(parent);

            // 메인 디렉셔널 라이트
            GameObject dirLight = new GameObject("Main Directional Light");
            dirLight.transform.SetParent(lightingRoot.transform);
            dirLight.transform.rotation = Quaternion.Euler(50, -30, 0);

            Light dirLightComp = dirLight.AddComponent<Light>();
            dirLightComp.type = LightType.Directional;
            dirLightComp.intensity = GetDirectionalLightIntensity();
            dirLightComp.color = GetLightColor();
            dirLightComp.shadows = LightShadows.Soft;

            // 천장 포인트 라이트 (8개)
            int lightsPerRow = 4;
            float spacing = roomWidth / (lightsPerRow + 1);

            for (int x = 0; x < lightsPerRow; x++)
            {
                for (int z = 0; z < lightsPerRow; z++)
                {
                    Vector3 pos = new Vector3(
                        -roomWidth / 2 + spacing * (x + 1),
                        roomHeight - 0.3f,
                        -roomLength / 2 + spacing * (z + 1)
                    );

                    CreatePointLight(lightingRoot.transform, $"CeilingLight_{x}_{z}", pos);
                }
            }

            Debug.Log($"[GallerySetup] 조명 설정 완료 ({selectedStyle})");
        }

        private void CreatePointLight(Transform parent, string name, Vector3 position)
        {
            GameObject pointLight = new GameObject(name);
            pointLight.transform.SetParent(parent);
            pointLight.transform.localPosition = position;

            Light lightComp = pointLight.AddComponent<Light>();
            lightComp.type = LightType.Point;
            lightComp.intensity = GetPointLightIntensity();
            lightComp.range = 8f;
            lightComp.color = GetLightColor();
            lightComp.shadows = LightShadows.None; // 베이킹으로 처리
        }

        private float GetDirectionalLightIntensity()
        {
            switch (selectedStyle)
            {
                case GalleryStyle.WarmGallery: return 0.8f;
                case GalleryStyle.CoolModern: return 1.0f;
                case GalleryStyle.NaturalDaylight: return 1.2f;
                case GalleryStyle.DramaticSpot: return 0.5f;
                case GalleryStyle.EveningAmbient: return 0.6f;
                default: return 1.0f;
            }
        }

        private float GetPointLightIntensity()
        {
            switch (selectedStyle)
            {
                case GalleryStyle.WarmGallery: return 1.0f;
                case GalleryStyle.CoolModern: return 1.2f;
                case GalleryStyle.NaturalDaylight: return 0.8f;
                case GalleryStyle.DramaticSpot: return 0.5f;
                case GalleryStyle.EveningAmbient: return 0.7f;
                default: return 1.0f;
            }
        }

        private Color GetLightColor()
        {
            switch (selectedStyle)
            {
                case GalleryStyle.WarmGallery:
                    return new Color(1.0f, 0.95f, 0.8f); // 따뜻한 황금빛

                case GalleryStyle.CoolModern:
                    return new Color(0.95f, 0.98f, 1.0f); // 차가운 백색광

                case GalleryStyle.NaturalDaylight:
                    return new Color(1.0f, 0.98f, 0.95f); // 자연광

                case GalleryStyle.DramaticSpot:
                    return Color.white; // 순백색

                case GalleryStyle.EveningAmbient:
                    return new Color(1.0f, 0.92f, 0.75f); // 저녁빛

                default:
                    return Color.white;
            }
        }

        private void SetupReflections(Transform parent)
        {
            GameObject reflectionProbe = new GameObject("ReflectionProbe");
            reflectionProbe.transform.SetParent(parent);
            reflectionProbe.transform.localPosition = new Vector3(0, roomHeight / 2, 0);

            ReflectionProbe probe = reflectionProbe.AddComponent<ReflectionProbe>();
            probe.mode = UnityEngine.Rendering.ReflectionProbeMode.Baked;
            probe.size = new Vector3(roomWidth - 1, roomHeight - 1, roomLength - 1);
            probe.resolution = 512;
            probe.hdr = true;
            probe.boxProjection = true;

            Debug.Log("[GallerySetup] Reflection Probe 생성 완료");
        }

        private void SetupPostProcessing()
        {
            // Post Processing Volume 찾기 또는 생성
            var volume = FindObjectOfType<UnityEngine.Rendering.Volume>();

            if (volume == null)
            {
                GameObject volumeObj = new GameObject("Global Post-Processing");
                volume = volumeObj.AddComponent<UnityEngine.Rendering.Volume>();
                volume.isGlobal = true;

                Debug.Log("[GallerySetup] Post-Processing Volume 생성 완료");
            }

            Debug.Log("[GallerySetup] Post-Processing 설정 완료");
        }
    }
}
