using UnityEngine;
using UnityEngine.Networking;
using System.Collections;
using Unity.Netcode;

namespace Metaverse.Gallery
{
    /// <summary>
    /// 2D 작품(그림, 사진)을 전시하는 액자 시스템
    /// URL 또는 로컬 리소스에서 이미지를 로드하여 표시
    /// </summary>
    public class ArtworkFrame : NetworkBehaviour
    {
        [Header("Artwork Settings")]
        [SerializeField] private string artworkURL = "";
        [SerializeField] private string artworkTitle = "Untitled";
        [SerializeField] private string artistName = "Unknown Artist";
        [SerializeField] [TextArea(3, 5)] private string description = "";

        [Header("Display Settings")]
        [SerializeField] private Renderer frameRenderer;
        [SerializeField] private Material defaultMaterial;
        [SerializeField] private Vector2 maxTextureSize = new Vector2(2048, 2048);
        [SerializeField] private bool maintainAspectRatio = true;

        [Header("Interaction")]
        [SerializeField] private float interactionDistance = 3f;
        [SerializeField] private KeyCode interactionKey = KeyCode.E;
        [SerializeField] private bool showInfoOnHover = true;

        [Header("Loading")]
        [SerializeField] private Texture2D loadingTexture;
        [SerializeField] private Texture2D errorTexture;

        // Runtime state
        private Texture2D loadedTexture;
        private bool isLoading = false;
        private bool isLoaded = false;
        private Transform playerTransform; // 가까운 플레이어 추적

        private void Start()
        {
            InitializeFrame();

            if (!string.IsNullOrEmpty(artworkURL))
            {
                StartCoroutine(LoadArtworkFromURL(artworkURL));
            }
        }

        /// <summary>
        /// 액자 초기화
        /// </summary>
        private void InitializeFrame()
        {
            if (frameRenderer == null)
            {
                frameRenderer = GetComponent<Renderer>();
            }

            if (frameRenderer != null && defaultMaterial == null)
            {
                defaultMaterial = frameRenderer.material;
            }

            // 로딩 텍스처 표시
            if (loadingTexture != null && frameRenderer != null)
            {
                frameRenderer.material.mainTexture = loadingTexture;
            }
        }

        /// <summary>
        /// URL에서 작품 이미지 로드
        /// </summary>
        public IEnumerator LoadArtworkFromURL(string url)
        {
            if (isLoading)
            {
                Debug.LogWarning($"[ArtworkFrame] Already loading artwork: {artworkTitle}");
                yield break;
            }

            isLoading = true;
            artworkURL = url;

            Debug.Log($"[ArtworkFrame] Loading artwork from URL: {url}");

            using (UnityWebRequest request = UnityWebRequestTexture.GetTexture(url))
            {
                yield return request.SendWebRequest();

                if (request.result == UnityWebRequest.Result.Success)
                {
                    Texture2D downloadedTexture = DownloadHandlerTexture.GetContent(request);

                    // 텍스처 크기 제한
                    Texture2D resizedTexture = ResizeTexture(downloadedTexture);

                    ApplyTexture(resizedTexture);
                    isLoaded = true;

                    Debug.Log($"[ArtworkFrame] ✓ Loaded artwork: {artworkTitle} ({resizedTexture.width}x{resizedTexture.height})");
                }
                else
                {
                    Debug.LogError($"[ArtworkFrame] Failed to load artwork from {url}: {request.error}");
                    ApplyErrorTexture();
                }
            }

            isLoading = false;
        }

        /// <summary>
        /// 텍스처를 액자에 적용
        /// </summary>
        private void ApplyTexture(Texture2D texture)
        {
            loadedTexture = texture;

            if (frameRenderer != null)
            {
                frameRenderer.material.mainTexture = texture;

                // 종횡비 유지하면서 스케일 조정
                if (maintainAspectRatio)
                {
                    AdjustFrameScale(texture);
                }
            }
        }

        /// <summary>
        /// 에러 텍스처 표시
        /// </summary>
        private void ApplyErrorTexture()
        {
            if (errorTexture != null && frameRenderer != null)
            {
                frameRenderer.material.mainTexture = errorTexture;
            }
        }

        /// <summary>
        /// 텍스처 크기 조정 (메모리 최적화)
        /// </summary>
        private Texture2D ResizeTexture(Texture2D source)
        {
            if (source.width <= maxTextureSize.x && source.height <= maxTextureSize.y)
            {
                return source; // 이미 적절한 크기
            }

            float scale = Mathf.Min(maxTextureSize.x / source.width, maxTextureSize.y / source.height);
            int newWidth = Mathf.RoundToInt(source.width * scale);
            int newHeight = Mathf.RoundToInt(source.height * scale);

            RenderTexture rt = RenderTexture.GetTemporary(newWidth, newHeight);
            RenderTexture.active = rt;

            Graphics.Blit(source, rt);

            Texture2D resized = new Texture2D(newWidth, newHeight);
            resized.ReadPixels(new Rect(0, 0, newWidth, newHeight), 0, 0);
            resized.Apply();

            RenderTexture.active = null;
            RenderTexture.ReleaseTemporary(rt);

            return resized;
        }

        /// <summary>
        /// 액자 스케일을 이미지 종횡비에 맞게 조정
        /// </summary>
        private void AdjustFrameScale(Texture2D texture)
        {
            if (texture == null) return;

            float aspectRatio = (float)texture.width / texture.height;
            Vector3 scale = transform.localScale;

            // 가로가 세로보다 긴 경우 (가로 기준)
            if (aspectRatio > 1f)
            {
                scale.y = scale.x / aspectRatio;
            }
            // 세로가 가로보다 긴 경우 (세로 기준)
            else
            {
                scale.x = scale.y * aspectRatio;
            }

            transform.localScale = scale;
        }

        /// <summary>
        /// 플레이어와의 거리 체크 및 상호작용
        /// </summary>
        private void Update()
        {
            if (!isLoaded) return;

            // 가까운 플레이어 찾기 (로컬 플레이어만)
            if (playerTransform == null)
            {
                GameObject player = GameObject.FindGameObjectWithTag("Player");
                if (player != null)
                {
                    playerTransform = player.transform;
                }
                return;
            }

            float distance = Vector3.Distance(transform.position, playerTransform.position);

            // 상호작용 거리 내에 있을 때
            if (distance <= interactionDistance)
            {
                if (Input.GetKeyDown(interactionKey))
                {
                    ShowArtworkDetails();
                }
            }
        }

        /// <summary>
        /// 작품 상세 정보 표시
        /// </summary>
        public void ShowArtworkDetails()
        {
            Debug.Log($"=== Artwork Details ===\nTitle: {artworkTitle}\nArtist: {artistName}\nDescription: {description}");

            // TODO: UI 패널에 정보 표시
            // ArtworkDetailPanel.Instance.Show(artworkTitle, artistName, description, loadedTexture);
        }

        /// <summary>
        /// 작품 정보 설정 (런타임)
        /// </summary>
        public void SetArtworkInfo(string title, string artist, string desc, string url)
        {
            artworkTitle = title;
            artistName = artist;
            description = desc;
            artworkURL = url;

            if (!string.IsNullOrEmpty(url))
            {
                StartCoroutine(LoadArtworkFromURL(url));
            }
        }

        /// <summary>
        /// 로컬 Texture2D 직접 설정
        /// </summary>
        public void SetArtworkTexture(Texture2D texture, string title = "Untitled", string artist = "Unknown")
        {
            artworkTitle = title;
            artistName = artist;
            ApplyTexture(texture);
            isLoaded = true;
        }

        private void OnDestroy()
        {
            // 메모리 해제
            if (loadedTexture != null)
            {
                Destroy(loadedTexture);
            }
        }

        #region Gizmos

        private void OnDrawGizmosSelected()
        {
            // 상호작용 범위 표시
            Gizmos.color = Color.green;
            Gizmos.DrawWireSphere(transform.position, interactionDistance);
        }

        #endregion

        #region Public API

        public string GetArtworkTitle() => artworkTitle;
        public string GetArtistName() => artistName;
        public string GetDescription() => description;
        public Texture2D GetTexture() => loadedTexture;
        public bool IsLoaded() => isLoaded;

        #endregion
    }
}
