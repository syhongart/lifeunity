using UnityEngine;
using Unity.Services.Vivox;

namespace Metaverse.Social.Voice
{
    /// <summary>
    /// Vivox를 사용한 음성 채팅 관리자
    /// 3D 공간 음향(Proximity Voice) 지원
    /// </summary>
    public class VoiceChatManager : MonoBehaviour
    {
        private static VoiceChatManager instance;
        public static VoiceChatManager Instance
        {
            get
            {
                if (instance == null)
                {
                    instance = FindObjectOfType<VoiceChatManager>();
                }
                return instance;
            }
        }

        [Header("Voice Settings")]
        [SerializeField] private bool enableVoiceChat = true;
        [SerializeField] private bool useProximityVoice = true; // 3D 공간 음향
        [SerializeField] private float maxHearingDistance = 20f;
        [SerializeField] private float audioFadeDistance = 5f;

        [Header("Audio Settings")]
        [SerializeField] [Range(0f, 100f)] private float masterVolume = 80f;
        [SerializeField] [Range(0f, 100f)] private float microphoneVolume = 80f;
        [SerializeField] private bool muteMicrophone = false;
        [SerializeField] private bool muteAllPlayers = false;

        [Header("Debug")]
        [SerializeField] private bool showDebugInfo = true;

        // Vivox client (Unity Services)
        // NOTE: Vivox SDK는 Unity Services를 통해 통합되어야 합니다
        // 이 스크립트는 기본 구조를 제공하며, 실제 Vivox 초기화는 별도 설정이 필요합니다

        private bool isInitialized = false;
        private bool isConnected = false;
        private string currentChannelName = "MainWorld";

        private void Awake()
        {
            if (instance != null && instance != this)
            {
                Destroy(gameObject);
                return;
            }

            instance = this;
            DontDestroyOnLoad(gameObject);
        }

        private void Start()
        {
            if (enableVoiceChat)
            {
                InitializeVoiceChat();
            }
        }

        /// <summary>
        /// 음성 채팅 초기화
        /// </summary>
        private void InitializeVoiceChat()
        {
            if (isInitialized)
            {
                Debug.LogWarning("[VoiceChatManager] Already initialized");
                return;
            }

            if (showDebugInfo) Debug.Log("[VoiceChatManager] Initializing voice chat...");

            // TODO: Vivox SDK 초기화
            // VivoxService.Instance.Initialize();

            isInitialized = true;

            if (showDebugInfo) Debug.Log("[VoiceChatManager] ✓ Voice chat initialized");
        }

        /// <summary>
        /// 음성 채널에 접속
        /// </summary>
        public void JoinChannel(string channelName)
        {
            if (!isInitialized)
            {
                Debug.LogError("[VoiceChatManager] Not initialized!");
                return;
            }

            currentChannelName = channelName;

            if (showDebugInfo) Debug.Log($"[VoiceChatManager] Joining voice channel: {channelName}");

            // TODO: Vivox 채널 접속
            // if (useProximityVoice)
            // {
            //     VivoxService.Instance.Join3DChannel(channelName, maxHearingDistance, audioFadeDistance);
            // }
            // else
            // {
            //     VivoxService.Instance.JoinChannel(channelName);
            // }

            isConnected = true;
        }

        /// <summary>
        /// 음성 채널에서 나가기
        /// </summary>
        public void LeaveChannel()
        {
            if (!isConnected) return;

            if (showDebugInfo) Debug.Log($"[VoiceChatManager] Leaving voice channel: {currentChannelName}");

            // TODO: Vivox 채널 나가기
            // VivoxService.Instance.LeaveChannel(currentChannelName);

            isConnected = false;
        }

        /// <summary>
        /// 마이크 음소거 토글
        /// </summary>
        public void ToggleMicrophone()
        {
            muteMicrophone = !muteMicrophone;
            ApplyMicrophoneMute();
        }

        /// <summary>
        /// 마이크 음소거 적용
        /// </summary>
        private void ApplyMicrophoneMute()
        {
            if (!isInitialized) return;

            if (showDebugInfo) Debug.Log($"[VoiceChatManager] Microphone {(muteMicrophone ? "muted" : "unmuted")}");

            // TODO: Vivox 마이크 음소거
            // VivoxService.Instance.SetMicrophoneMute(muteMicrophone);
        }

        /// <summary>
        /// 모든 플레이어 음소거 토글
        /// </summary>
        public void ToggleMuteAll()
        {
            muteAllPlayers = !muteAllPlayers;
            ApplyMuteAll();
        }

        /// <summary>
        /// 모든 플레이어 음소거 적용
        /// </summary>
        private void ApplyMuteAll()
        {
            if (!isInitialized) return;

            if (showDebugInfo) Debug.Log($"[VoiceChatManager] All players {(muteAllPlayers ? "muted" : "unmuted")}");

            // TODO: Vivox 모든 플레이어 음소거
            // VivoxService.Instance.SetMasterMute(muteAllPlayers);
        }

        /// <summary>
        /// 마스터 볼륨 설정
        /// </summary>
        public void SetMasterVolume(float volume)
        {
            masterVolume = Mathf.Clamp(volume, 0f, 100f);
            ApplyMasterVolume();
        }

        /// <summary>
        /// 마스터 볼륨 적용
        /// </summary>
        private void ApplyMasterVolume()
        {
            if (!isInitialized) return;

            // TODO: Vivox 볼륨 설정
            // VivoxService.Instance.SetMasterVolume((int)masterVolume);
        }

        /// <summary>
        /// 마이크 볼륨 설정
        /// </summary>
        public void SetMicrophoneVolume(float volume)
        {
            microphoneVolume = Mathf.Clamp(volume, 0f, 100f);
            ApplyMicrophoneVolume();
        }

        /// <summary>
        /// 마이크 볼륨 적용
        /// </summary>
        private void ApplyMicrophoneVolume()
        {
            if (!isInitialized) return;

            // TODO: Vivox 마이크 볼륨 설정
            // VivoxService.Instance.SetMicrophoneVolume((int)microphoneVolume);
        }

        /// <summary>
        /// 3D 위치 음향 업데이트 (플레이어 위치 기반)
        /// </summary>
        public void UpdateListenerPosition(Vector3 position, Quaternion rotation, Vector3 forward, Vector3 up)
        {
            if (!isInitialized || !useProximityVoice) return;

            // TODO: Vivox 3D 오디오 리스너 위치 업데이트
            // VivoxService.Instance.Update3DPosition(position, rotation, forward, up);
        }

        #region Public API

        public bool IsInitialized() => isInitialized;
        public bool IsConnected() => isConnected;
        public bool IsMicrophoneMuted() => muteMicrophone;
        public bool IsAllMuted() => muteAllPlayers;
        public float GetMasterVolume() => masterVolume;
        public float GetMicrophoneVolume() => microphoneVolume;

        #endregion

        #region Debug UI

        private void OnGUI()
        {
            if (!showDebugInfo) return;

            GUIStyle style = new GUIStyle();
            style.fontSize = 12;
            style.normal.textColor = Color.yellow;
            style.padding = new RectOffset(10, 10, 10, 10);

            int yOffset = 100;

            GUI.Label(new Rect(10, yOffset, 300, 25), $"Voice: {(isConnected ? "Connected" : "Disconnected")}", style);
            GUI.Label(new Rect(10, yOffset + 25, 300, 25), $"Mic: {(muteMicrophone ? "Muted" : "Unmuted")}", style);
            GUI.Label(new Rect(10, yOffset + 50, 300, 25), $"Channel: {currentChannelName}", style);
        }

        #endregion

        private void OnDestroy()
        {
            if (isConnected)
            {
                LeaveChannel();
            }
        }
    }
}
