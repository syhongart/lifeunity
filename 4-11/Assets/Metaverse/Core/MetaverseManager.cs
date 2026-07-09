using UnityEngine;
using Unity.Netcode;

namespace Metaverse.Core
{
    /// <summary>
    /// 메타버스 상태 열거형
    /// </summary>
    public enum MetaverseState
    {
        Disconnected,   // 연결 안 됨
        Connecting,     // 연결 중
        InLobby,        // 로비 (메인 메뉴)
        LoadingWorld,   // 월드 로딩 중
        InWorld,        // 월드 내부 (자유 탐험)
        InGallery,      // 갤러리 내부 (작품 관람)
        InEvent         // 이벤트 참여 중
    }

    /// <summary>
    /// 메타버스의 전체 상태를 관리하는 싱글톤 매니저
    /// 기존 GameManager를 메타버스 환경에 맞게 재설계
    /// </summary>
    public class MetaverseManager : MonoBehaviour
    {
        private static MetaverseManager instance;
        public static MetaverseManager Instance
        {
            get
            {
                if (instance == null)
                {
                    instance = FindObjectOfType<MetaverseManager>();
                    if (instance == null)
                    {
                        GameObject go = new GameObject("MetaverseManager");
                        instance = go.AddComponent<MetaverseManager>();
                    }
                }
                return instance;
            }
        }

        [Header("Current State")]
        [SerializeField] private MetaverseState currentState = MetaverseState.Disconnected;

        [Header("World Settings")]
        [SerializeField] private int maxPlayersPerWorld = 50;
        [SerializeField] private string currentWorldName = "MainGallery";

        [Header("Player Stats")]
        [SerializeField] private int connectedPlayerCount = 0;

        [Header("Debug")]
        [SerializeField] private bool showDebugInfo = true;

        // Events for state changes
        public System.Action<MetaverseState> OnStateChanged;
        public System.Action<int> OnPlayerCountChanged;

        private NetworkManager networkManager;

        private void Awake()
        {
            // Singleton pattern
            if (instance != null && instance != this)
            {
                Destroy(gameObject);
                return;
            }

            instance = this;
            DontDestroyOnLoad(gameObject);

            InitializeManager();
        }

        private void InitializeManager()
        {
            networkManager = FindObjectOfType<NetworkManager>();

            if (networkManager != null)
            {
                networkManager.OnClientConnectedCallback += OnPlayerJoined;
                networkManager.OnClientDisconnectCallback += OnPlayerLeft;
            }

            if (showDebugInfo)
            {
                Debug.Log("[MetaverseManager] Initialized");
            }
        }

        private void Start()
        {
            SetState(MetaverseState.Disconnected);
        }

        #region State Management

        /// <summary>
        /// 메타버스 상태 변경
        /// </summary>
        public void SetState(MetaverseState newState)
        {
            if (currentState == newState) return;

            MetaverseState previousState = currentState;
            currentState = newState;

            if (showDebugInfo)
            {
                Debug.Log($"[MetaverseManager] State changed: {previousState} → {newState}");
            }

            OnStateChanged?.Invoke(newState);
            HandleStateChange(newState);
        }

        /// <summary>
        /// 현재 상태 반환
        /// </summary>
        public MetaverseState GetCurrentState()
        {
            return currentState;
        }

        /// <summary>
        /// 상태 변경 시 실행되는 로직
        /// </summary>
        private void HandleStateChange(MetaverseState state)
        {
            switch (state)
            {
                case MetaverseState.Disconnected:
                    HandleDisconnectedState();
                    break;
                case MetaverseState.Connecting:
                    HandleConnectingState();
                    break;
                case MetaverseState.InLobby:
                    HandleLobbyState();
                    break;
                case MetaverseState.LoadingWorld:
                    HandleLoadingWorldState();
                    break;
                case MetaverseState.InWorld:
                    HandleInWorldState();
                    break;
                case MetaverseState.InGallery:
                    HandleInGalleryState();
                    break;
                case MetaverseState.InEvent:
                    HandleInEventState();
                    break;
            }
        }

        #endregion

        #region State Handlers

        private void HandleDisconnectedState()
        {
            // 연결 해제 시 정리 작업
            connectedPlayerCount = 0;
            OnPlayerCountChanged?.Invoke(0);
        }

        private void HandleConnectingState()
        {
            // 연결 시도 중 로딩 UI 표시 등
            if (showDebugInfo) Debug.Log("[MetaverseManager] Attempting to connect to metaverse...");
        }

        private void HandleLobbyState()
        {
            // 로비 진입 시 UI 활성화
            if (showDebugInfo) Debug.Log("[MetaverseManager] Entered lobby");
        }

        private void HandleLoadingWorldState()
        {
            // 월드 로딩 화면 표시
            if (showDebugInfo) Debug.Log($"[MetaverseManager] Loading world: {currentWorldName}");
        }

        private void HandleInWorldState()
        {
            // 월드 내부 - 자유 탐험 모드
            if (showDebugInfo) Debug.Log("[MetaverseManager] Entered world - free exploration mode");
        }

        private void HandleInGalleryState()
        {
            // 갤러리 모드 - 작품 감상
            if (showDebugInfo) Debug.Log("[MetaverseManager] Entered gallery mode");
        }

        private void HandleInEventState()
        {
            // 이벤트 모드
            if (showDebugInfo) Debug.Log("[MetaverseManager] Joined event");
        }

        #endregion

        #region Player Management

        private void OnPlayerJoined(ulong clientId)
        {
            connectedPlayerCount++;
            OnPlayerCountChanged?.Invoke(connectedPlayerCount);

            if (showDebugInfo)
            {
                Debug.Log($"[MetaverseManager] Player joined (ID: {clientId}). Total players: {connectedPlayerCount}");
            }
        }

        private void OnPlayerLeft(ulong clientId)
        {
            connectedPlayerCount--;
            OnPlayerCountChanged?.Invoke(connectedPlayerCount);

            if (showDebugInfo)
            {
                Debug.Log($"[MetaverseManager] Player left (ID: {clientId}). Total players: {connectedPlayerCount}");
            }
        }

        public int GetPlayerCount()
        {
            return connectedPlayerCount;
        }

        public int GetMaxPlayers()
        {
            return maxPlayersPerWorld;
        }

        #endregion

        #region World Management

        /// <summary>
        /// 월드 변경
        /// </summary>
        public void LoadWorld(string worldName)
        {
            currentWorldName = worldName;
            SetState(MetaverseState.LoadingWorld);

            // TODO: 실제 씬 로딩 로직
            if (showDebugInfo) Debug.Log($"[MetaverseManager] Loading world: {worldName}");
        }

        public string GetCurrentWorldName()
        {
            return currentWorldName;
        }

        #endregion

        #region UI Helper Methods

        /// <summary>
        /// 갤러리 입장
        /// </summary>
        public void EnterGallery()
        {
            SetState(MetaverseState.InGallery);
        }

        /// <summary>
        /// 갤러리 퇴장
        /// </summary>
        public void ExitGallery()
        {
            SetState(MetaverseState.InWorld);
        }

        #endregion

        private void OnDestroy()
        {
            if (networkManager != null)
            {
                networkManager.OnClientConnectedCallback -= OnPlayerJoined;
                networkManager.OnClientDisconnectCallback -= OnPlayerLeft;
            }
        }

        #region Debug Info

        private void OnGUI()
        {
            if (!showDebugInfo) return;

            GUIStyle style = new GUIStyle();
            style.fontSize = 14;
            style.normal.textColor = Color.white;
            style.padding = new RectOffset(10, 10, 10, 10);

            GUI.Label(new Rect(10, 10, 300, 25), $"State: {currentState}", style);
            GUI.Label(new Rect(10, 35, 300, 25), $"Players: {connectedPlayerCount}/{maxPlayersPerWorld}", style);
            GUI.Label(new Rect(10, 60, 300, 25), $"World: {currentWorldName}", style);
        }

        #endregion
    }
}
