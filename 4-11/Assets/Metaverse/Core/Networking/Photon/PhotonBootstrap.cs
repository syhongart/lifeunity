using UnityEngine;

// NOTE: Photon PUN2를 Asset Store에서 설치한 후 아래 주석을 해제하세요
// using Photon.Pun;
// using Photon.Realtime;

namespace Metaverse.Core.Networking.Photon
{
    /// <summary>
    /// Photon PUN2 네트워킹 부트스트랩
    /// WebGL, 모바일, PC 모두 지원
    ///
    /// 사용 방법:
    /// 1. Asset Store에서 "Photon PUN 2 - FREE" 다운로드
    /// 2. Photon 계정 생성 및 App ID 발급 (https://dashboard.photonengine.com)
    /// 3. Window > Photon Unity Networking > PUN Wizard > App ID 입력
    /// 4. 이 스크립트의 주석 해제 (위의 using 문)
    /// 5. GameObject에 추가 및 실행
    /// </summary>
    public class PhotonBootstrap : MonoBehaviour // MonoBehaviourPunCallbacks로 변경
    {
        [Header("Connection Settings")]
        [SerializeField] private string gameVersion = "1.0";
        [SerializeField] private byte maxPlayersPerRoom = 50;
        [SerializeField] private bool autoConnect = true;

        [Header("Room Settings")]
        [SerializeField] private string roomName = "MainGallery";
        [SerializeField] private bool createRoomIfNotExists = true;

        [Header("Debug")]
        [SerializeField] private bool showDebugLogs = true;

        private void Start()
        {
            if (autoConnect)
            {
                ConnectToPhoton();
            }
        }

        /// <summary>
        /// Photon Cloud에 연결
        /// </summary>
        public void ConnectToPhoton()
        {
            if (showDebugLogs) Debug.Log("[PhotonBootstrap] Connecting to Photon Cloud...");

            /* Photon PUN2 설치 후 주석 해제:

            // 게임 버전 설정
            PhotonNetwork.GameVersion = gameVersion;

            // Photon Cloud 연결
            PhotonNetwork.ConnectUsingSettings();

            */

            // 임시 (Photon 미설치 시)
            Debug.LogWarning("[PhotonBootstrap] Photon PUN2가 설치되지 않았습니다. Asset Store에서 다운로드하세요.");
        }

        /* Photon PUN2 설치 후 주석 해제:

        #region Photon Callbacks

        public override void OnConnectedToMaster()
        {
            if (showDebugLogs) Debug.Log("[PhotonBootstrap] ✓ Connected to Photon Cloud!");

            // 로비 진입
            PhotonNetwork.JoinLobby();
        }

        public override void OnJoinedLobby()
        {
            if (showDebugLogs) Debug.Log("[PhotonBootstrap] Joined lobby");

            if (createRoomIfNotExists)
            {
                // 랜덤 방 참가 시도, 없으면 생성
                PhotonNetwork.JoinRandomOrCreateRoom(
                    expectedRoomProperties: null,
                    expectedMaxPlayers: maxPlayersPerRoom,
                    roomOptions: new RoomOptions
                    {
                        MaxPlayers = maxPlayersPerRoom,
                        IsVisible = true,
                        IsOpen = true
                    },
                    typedLobby: null,
                    roomName: roomName
                );
            }
            else
            {
                JoinRoom(roomName);
            }
        }

        public override void OnJoinedRoom()
        {
            if (showDebugLogs)
            {
                Debug.Log($"[PhotonBootstrap] ✓ Joined room: {PhotonNetwork.CurrentRoom.Name}");
                Debug.Log($"[PhotonBootstrap] Players in room: {PhotonNetwork.CurrentRoom.PlayerCount}/{PhotonNetwork.CurrentRoom.MaxPlayers}");
            }

            // 플레이어 스폰
            SpawnPlayer();
        }

        public override void OnCreateRoomFailed(short returnCode, string message)
        {
            Debug.LogError($"[PhotonBootstrap] Failed to create room: {message}");
        }

        public override void OnJoinRoomFailed(short returnCode, string message)
        {
            Debug.LogError($"[PhotonBootstrap] Failed to join room: {message}");
        }

        public override void OnJoinRandomFailed(short returnCode, string message)
        {
            if (showDebugLogs) Debug.Log("[PhotonBootstrap] No random room available, creating new room...");

            CreateRoom(roomName);
        }

        public override void OnPlayerEnteredRoom(Photon.Realtime.Player newPlayer)
        {
            if (showDebugLogs)
            {
                Debug.Log($"[PhotonBootstrap] Player joined: {newPlayer.NickName} (Total: {PhotonNetwork.CurrentRoom.PlayerCount})");
            }
        }

        public override void OnPlayerLeftRoom(Photon.Realtime.Player otherPlayer)
        {
            if (showDebugLogs)
            {
                Debug.Log($"[PhotonBootstrap] Player left: {otherPlayer.NickName} (Total: {PhotonNetwork.CurrentRoom.PlayerCount})");
            }
        }

        public override void OnDisconnected(DisconnectCause cause)
        {
            Debug.LogWarning($"[PhotonBootstrap] Disconnected from Photon: {cause}");
        }

        #endregion

        #region Public Methods

        /// <summary>
        /// 플레이어 스폰
        /// </summary>
        private void SpawnPlayer()
        {
            if (PhotonNetwork.IsConnectedAndReady)
            {
                // 랜덤 스폰 위치
                Vector3 spawnPosition = new Vector3(
                    Random.Range(-5f, 5f),
                    1f,
                    Random.Range(-5f, 5f)
                );

                // 플레이어 프리팹 스폰 (PhotonNetwork.Instantiate 사용)
                // Resources 폴더에 "PhotonPlayer" 프리팹 필요
                PhotonNetwork.Instantiate("PhotonPlayer", spawnPosition, Quaternion.identity);

                if (showDebugLogs) Debug.Log("[PhotonBootstrap] Player spawned");
            }
        }

        /// <summary>
        /// 특정 방 생성
        /// </summary>
        public void CreateRoom(string name)
        {
            RoomOptions options = new RoomOptions
            {
                MaxPlayers = maxPlayersPerRoom,
                IsVisible = true,
                IsOpen = true
            };

            PhotonNetwork.CreateRoom(name, options);
        }

        /// <summary>
        /// 특정 방 참가
        /// </summary>
        public void JoinRoom(string name)
        {
            PhotonNetwork.JoinRoom(name);
        }

        /// <summary>
        /// 랜덤 방 참가
        /// </summary>
        public void JoinRandomRoom()
        {
            PhotonNetwork.JoinRandomRoom();
        }

        /// <summary>
        /// 방 나가기
        /// </summary>
        public void LeaveRoom()
        {
            if (PhotonNetwork.InRoom)
            {
                PhotonNetwork.LeaveRoom();
            }
        }

        /// <summary>
        /// Photon 연결 해제
        /// </summary>
        public void Disconnect()
        {
            if (PhotonNetwork.IsConnected)
            {
                PhotonNetwork.Disconnect();
            }
        }

        #endregion

        */

        #region Debug UI

        private void OnGUI()
        {
            if (!showDebugLogs) return;

            GUIStyle style = new GUIStyle();
            style.fontSize = 14;
            style.normal.textColor = Color.white;
            style.padding = new RectOffset(10, 10, 10, 10);

            /* Photon 설치 후 주석 해제:

            GUI.Label(new Rect(10, 10, 400, 25),
                $"Photon Status: {PhotonNetwork.NetworkClientState}", style);

            if (PhotonNetwork.InRoom)
            {
                GUI.Label(new Rect(10, 35, 400, 25),
                    $"Room: {PhotonNetwork.CurrentRoom.Name}", style);
                GUI.Label(new Rect(10, 60, 400, 25),
                    $"Players: {PhotonNetwork.CurrentRoom.PlayerCount}/{PhotonNetwork.CurrentRoom.MaxPlayers}", style);
            }

            */

            // 임시
            GUI.Label(new Rect(10, 10, 400, 25),
                "Photon Status: NOT INSTALLED", style);
            GUI.Label(new Rect(10, 35, 400, 25),
                "Please install Photon PUN2 from Asset Store", style);
        }

        #endregion
    }
}
