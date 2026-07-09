using UnityEditor;
using UnityEngine;
using System.IO;
using System.Diagnostics;

namespace Metaverse.Editor
{
    /// <summary>
    /// WebGL 자동 빌드 및 배포 도구
    /// 메뉴: Metaverse > Build & Deploy to Web
    /// </summary>
    public class WebGLBuilder : EditorWindow
    {
        private static string buildPath = "WebGL-Build";
        private static bool autoDeploy = true;
        private static bool openAfterBuild = true;

        [MenuItem("Metaverse/Build & Deploy to Web 🌐")]
        public static void ShowWindow()
        {
            WebGLBuilder window = GetWindow<WebGLBuilder>("WebGL Builder");
            window.minSize = new Vector2(400, 300);
            window.Show();
        }

        private void OnGUI()
        {
            GUILayout.Label("WebGL 빌드 및 배포", EditorStyles.boldLabel);
            GUILayout.Space(10);

            EditorGUILayout.HelpBox(
                "이 도구는 WebGL 빌드를 생성하고 GitHub Pages에 자동 배포합니다.\n\n" +
                "최종 URL: https://syhongart.github.io/lifeunity/",
                MessageType.Info
            );

            GUILayout.Space(10);

            // 설정
            GUILayout.Label("빌드 설정", EditorStyles.boldLabel);
            buildPath = EditorGUILayout.TextField("빌드 경로:", buildPath);
            autoDeploy = EditorGUILayout.Toggle("자동 배포 (GitHub Pages):", autoDeploy);
            openAfterBuild = EditorGUILayout.Toggle("빌드 후 브라우저 열기:", openAfterBuild);

            GUILayout.Space(20);

            // 빌드 버튼
            if (GUILayout.Button("🚀 WebGL 빌드 시작", GUILayout.Height(40)))
            {
                BuildWebGL();
            }

            GUILayout.Space(10);

            // 배포만 하기
            if (GUILayout.Button("📤 기존 빌드 배포하기", GUILayout.Height(30)))
            {
                DeployToGitHub();
            }

            GUILayout.Space(10);

            EditorGUILayout.HelpBox(
                "예상 소요 시간:\n" +
                "• 첫 빌드: 20-40분\n" +
                "• 이후 빌드: 5-10분\n" +
                "• 배포: 1-2분",
                MessageType.Warning
            );
        }

        /// <summary>
        /// WebGL 빌드 실행
        /// </summary>
        private static void BuildWebGL()
        {
            UnityEngine.Debug.Log("[WebGLBuilder] WebGL 빌드 시작...");

            // 빌드 옵션
            BuildPlayerOptions buildPlayerOptions = new BuildPlayerOptions
            {
                scenes = GetScenePaths(),
                locationPathName = buildPath,
                target = BuildTarget.WebGL,
                options = BuildOptions.None
            };

            // 빌드 실행
            UnityEngine.Debug.Log("[WebGLBuilder] 빌드 중... (20-40분 소요)");

            var report = BuildPipeline.BuildPlayer(buildPlayerOptions);

            if (report.summary.result == UnityEditor.Build.Reporting.BuildResult.Succeeded)
            {
                UnityEngine.Debug.Log($"[WebGLBuilder] ✅ 빌드 성공! ({report.summary.totalSize / (1024 * 1024)} MB)");
                UnityEngine.Debug.Log($"[WebGLBuilder] 경로: {buildPath}");

                // 자동 배포
                if (autoDeploy)
                {
                    DeployToGitHub();
                }

                // 브라우저 열기
                if (openAfterBuild)
                {
                    OpenInBrowser();
                }

                EditorUtility.DisplayDialog(
                    "빌드 완료!",
                    $"WebGL 빌드가 완료되었습니다.\n\n" +
                    $"크기: {report.summary.totalSize / (1024 * 1024)} MB\n" +
                    $"경로: {buildPath}\n\n" +
                    (autoDeploy ? "GitHub Pages 배포 중..." : ""),
                    "확인"
                );
            }
            else
            {
                UnityEngine.Debug.LogError($"[WebGLBuilder] ❌ 빌드 실패: {report.summary.result}");

                EditorUtility.DisplayDialog(
                    "빌드 실패",
                    $"빌드에 실패했습니다.\n{report.summary.result}\n\nConsole을 확인하세요.",
                    "확인"
                );
            }
        }

        /// <summary>
        /// 씬 경로 가져오기
        /// </summary>
        private static string[] GetScenePaths()
        {
            // Build Settings에 추가된 씬들
            string[] scenes = new string[EditorBuildSettings.scenes.Length];
            for (int i = 0; i < scenes.Length; i++)
            {
                scenes[i] = EditorBuildSettings.scenes[i].path;
            }

            // 씬이 없으면 현재 씬 사용
            if (scenes.Length == 0)
            {
                UnityEngine.Debug.LogWarning("[WebGLBuilder] Build Settings에 씬이 없습니다. 현재 씬을 사용합니다.");
                scenes = new string[] { UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene().path };
            }

            return scenes;
        }

        /// <summary>
        /// GitHub Pages에 배포
        /// </summary>
        private static void DeployToGitHub()
        {
            UnityEngine.Debug.Log("[WebGLBuilder] GitHub Pages 배포 시작...");

            string projectRoot = Directory.GetParent(Application.dataPath).Parent.FullName;
            string buildFullPath = Path.Combine(projectRoot, buildPath);

            if (!Directory.Exists(buildFullPath))
            {
                EditorUtility.DisplayDialog(
                    "배포 실패",
                    $"빌드 폴더를 찾을 수 없습니다.\n{buildFullPath}\n\n먼저 빌드를 실행하세요.",
                    "확인"
                );
                return;
            }

            // 배포 스크립트 생성
            string deployScript = Path.Combine(projectRoot, "deploy-webgl.sh");
            string scriptContent = $@"#!/bin/bash
set -e

echo ""[Deploy] WebGL 배포 시작...""

# 현재 브랜치 저장
CURRENT_BRANCH=$(git branch --show-current)
echo ""[Deploy] 현재 브랜치: $CURRENT_BRANCH""

# gh-pages 브랜치로 전환 (없으면 생성)
if git show-ref --verify --quiet refs/heads/gh-pages; then
    echo ""[Deploy] gh-pages 브랜치로 전환""
    git checkout gh-pages
else
    echo ""[Deploy] gh-pages 브랜치 생성""
    git checkout --orphan gh-pages
fi

# 기존 파일 삭제 (git 제외)
echo ""[Deploy] 기존 파일 정리...""
git rm -rf . 2>/dev/null || true
rm -rf * 2>/dev/null || true

# WebGL 빌드 복사
echo ""[Deploy] WebGL 파일 복사...""
cp -r ""{buildPath}""/* .

# Git 추가 및 커밋
echo ""[Deploy] Git 커밋...""
git add .
git commit -m ""WebGL build - $(date +'%Y-%m-%d %H:%M:%S')""

# 푸시
echo ""[Deploy] GitHub Pages 푸시...""
git push origin gh-pages --force

# 원래 브랜치로 복귀
echo ""[Deploy] 원래 브랜치로 복귀: $CURRENT_BRANCH""
git checkout ""$CURRENT_BRANCH""

echo ""[Deploy] ✅ 배포 완료!""
echo ""[Deploy] 🌐 URL: https://syhongart.github.io/lifeunity/""
echo ""[Deploy] ⏱️  5-10분 후 접속 가능합니다.""
";

            File.WriteAllText(deployScript, scriptContent);

            // 실행 권한 부여 (Linux/Mac)
            if (Application.platform == RuntimePlatform.OSXEditor ||
                Application.platform == RuntimePlatform.LinuxEditor)
            {
                Process.Start("chmod", $"+x {deployScript}");
            }

            // 배포 스크립트 실행
            UnityEngine.Debug.Log($"[WebGLBuilder] 배포 스크립트 실행: {deployScript}");

            try
            {
                ProcessStartInfo startInfo = new ProcessStartInfo
                {
                    FileName = Application.platform == RuntimePlatform.WindowsEditor ? "bash" : "/bin/bash",
                    Arguments = deployScript,
                    WorkingDirectory = projectRoot,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true
                };

                Process process = Process.Start(startInfo);
                string output = process.StandardOutput.ReadToEnd();
                string error = process.StandardError.ReadToEnd();
                process.WaitForExit();

                UnityEngine.Debug.Log($"[WebGLBuilder] 배포 출력:\n{output}");

                if (process.ExitCode == 0)
                {
                    UnityEngine.Debug.Log("[WebGLBuilder] ✅ GitHub Pages 배포 완료!");
                    UnityEngine.Debug.Log("[WebGLBuilder] 🌐 URL: https://syhongart.github.io/lifeunity/");
                    UnityEngine.Debug.Log("[WebGLBuilder] ⏱️  5-10분 후 접속 가능합니다.");

                    EditorUtility.DisplayDialog(
                        "배포 완료!",
                        "GitHub Pages에 배포되었습니다.\n\n" +
                        "🌐 URL: https://syhongart.github.io/lifeunity/\n\n" +
                        "⏱️  5-10분 후 접속 가능합니다.",
                        "확인"
                    );
                }
                else
                {
                    UnityEngine.Debug.LogError($"[WebGLBuilder] 배포 실패:\n{error}");

                    EditorUtility.DisplayDialog(
                        "배포 실패",
                        $"배포에 실패했습니다.\n\n{error}\n\nConsole을 확인하세요.",
                        "확인"
                    );
                }
            }
            catch (System.Exception e)
            {
                UnityEngine.Debug.LogError($"[WebGLBuilder] 배포 오류: {e.Message}");
                EditorUtility.DisplayDialog("배포 오류", $"배포 중 오류가 발생했습니다.\n\n{e.Message}", "확인");
            }
        }

        /// <summary>
        /// 로컬 서버로 브라우저 열기
        /// </summary>
        private static void OpenInBrowser()
        {
            string indexPath = Path.Combine(buildPath, "index.html");

            if (File.Exists(indexPath))
            {
                UnityEngine.Debug.Log($"[WebGLBuilder] 브라우저로 열기: {indexPath}");
                Application.OpenURL($"file://{Path.GetFullPath(indexPath)}");
            }
        }

        /// <summary>
        /// 명령줄에서 빌드 (CI/CD용)
        /// </summary>
        public static void BuildFromCommandLine()
        {
            UnityEngine.Debug.Log("[WebGLBuilder] 명령줄 빌드 시작...");
            BuildWebGL();
        }
    }
}
