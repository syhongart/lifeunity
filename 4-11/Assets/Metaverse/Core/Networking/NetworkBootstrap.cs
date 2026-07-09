using UnityEngine;
using Unity.Netcode;
using Unity.Netcode.Transports.UTP;

namespace Metaverse.Core.Networking
{
    /// <summary>
    /// 메타버스 네트워크 연결을 초기화하고 관리합니다.
    /// 게임 시작 시 서버 또는 클라이언트로 자동 연결합니다.
    /// </summary>
    public class NetworkBootstrap : MonoBehaviour
    {
        [Header("Connection Settings")]
        [SerializeField] private string serverAddress = "127.0.0.1";
        [SerializeField] private ushort serverPort = 7777;
        [SerializeField] private bool autoConnect = true;
        [SerializeField] private bool isServer = false; // false = client mode

        [Header("Debug")]
        [SerializeField] private bool showDebugLogs = true;

        private NetworkManager networkManager;
        private UnityTransport transport;

        private void Awake()
        {
            networkManager = GetComponent<NetworkManager>();
            if (networkManager == null)
            {
                Debug.LogError("[NetworkBootstrap] NetworkManager component not found!");
                return;
            }

            transport = GetComponent<UnityTransport>();
            if (transport == null)
            {
                Debug.LogError("[NetworkBootstrap] UnityTransport component not found!");
                return;
            }

            // 네트워크 이벤트 구독
            networkManager.OnServerStarted += OnServerStarted;
            networkManager.OnClientConnectedCallback += OnClientConnected;
            networkManager.OnClientDisconnectCallback += OnClientDisconnected;
        }

        private void Start()
        {
            if (autoConnect)
            {
                ConnectToMetaverse();
            }
        }

        /// <summary>
        /// 메타버스에 연결합니다 (서버 또는 클라이언트 모드)
        /// </summary>
        public void ConnectToMetaverse()
        {
            // 전송 설정
            transport.SetConnectionData(serverAddress, serverPort);

            if (isServer)
            {
                StartServer();
            }
            else
            {
                StartClient();
            }
        }

        /// <summary>
        /// 서버 모드로 시작 (호스팅)
        /// </summary>
        public void StartServer()
        {
            if (showDebugLogs) Debug.Log("[NetworkBootstrap] Starting server...");

            bool success = networkManager.StartServer();
            if (!success)
            {
                Debug.LogError("[NetworkBootstrap] Failed to start server!");
            }
        }

        /// <summary>
        /// 호스트 모드로 시작 (서버 + 클라이언트)
        /// </summary>
        public void StartHost()
        {
            if (showDebugLogs) Debug.Log("[NetworkBootstrap] Starting host...");

            bool success = networkManager.StartHost();
            if (!success)
            {
                Debug.LogError("[NetworkBootstrap] Failed to start host!");
            }
        }

        /// <summary>
        /// 클라이언트 모드로 시작 (접속)
        /// </summary>
        public void StartClient()
        {
            if (showDebugLogs) Debug.Log($"[NetworkBootstrap] Connecting to {serverAddress}:{serverPort}...");

            bool success = networkManager.StartClient();
            if (!success)
            {
                Debug.LogError("[NetworkBootstrap] Failed to start client!");
            }
        }

        /// <summary>
        /// 연결 종료
        /// </summary>
        public void Disconnect()
        {
            if (showDebugLogs) Debug.Log("[NetworkBootstrap] Disconnecting...");

            networkManager.Shutdown();
        }

        #region Network Callbacks

        private void OnServerStarted()
        {
            if (showDebugLogs) Debug.Log("[NetworkBootstrap] ✓ Server started successfully!");
        }

        private void OnClientConnected(ulong clientId)
        {
            if (showDebugLogs)
            {
                if (clientId == networkManager.LocalClientId)
                {
                    Debug.Log($"[NetworkBootstrap] ✓ Connected to metaverse! (Client ID: {clientId})");
                }
                else
                {
                    Debug.Log($"[NetworkBootstrap] Player joined: Client ID {clientId}");
                }
            }
        }

        private void OnClientDisconnected(ulong clientId)
        {
            if (showDebugLogs)
            {
                if (clientId == networkManager.LocalClientId)
                {
                    Debug.Log("[NetworkBootstrap] Disconnected from metaverse");
                }
                else
                {
                    Debug.Log($"[NetworkBootstrap] Player left: Client ID {clientId}");
                }
            }
        }

        #endregion

        private void OnDestroy()
        {
            if (networkManager != null)
            {
                networkManager.OnServerStarted -= OnServerStarted;
                networkManager.OnClientConnectedCallback -= OnClientConnected;
                networkManager.OnClientDisconnectCallback -= OnClientDisconnected;
            }
        }

        #region UI Helper Methods

        /// <summary>
        /// UI에서 호출 가능한 서버 주소 설정
        /// </summary>
        public void SetServerAddress(string address)
        {
            serverAddress = address;
        }

        /// <summary>
        /// UI에서 호출 가능한 포트 설정
        /// </summary>
        public void SetServerPort(ushort port)
        {
            serverPort = port;
        }

        #endregion
    }
}
