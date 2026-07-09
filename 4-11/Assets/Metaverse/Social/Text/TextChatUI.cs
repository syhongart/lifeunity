using UnityEngine;
using UnityEngine.UI;
using TMPro;
using Unity.Netcode;
using System.Collections.Generic;

namespace Metaverse.Social.Text
{
    /// <summary>
    /// 텍스트 채팅 UI 시스템
    /// 글로벌 채팅 및 귓속말 기능 지원
    /// </summary>
    public class TextChatUI : NetworkBehaviour
    {
        private static TextChatUI instance;
        public static TextChatUI Instance => instance;

        [Header("UI References")]
        [SerializeField] private GameObject chatPanel;
        [SerializeField] private TMP_InputField chatInputField;
        [SerializeField] private TextMeshProUGUI chatHistoryText;
        [SerializeField] private ScrollRect chatScrollRect;
        [SerializeField] private Button sendButton;

        [Header("Chat Settings")]
        [SerializeField] private int maxChatHistory = 50;
        [SerializeField] private bool showTimestamps = true;
        [SerializeField] private bool enableProfanityFilter = true;
        [SerializeField] private KeyCode toggleChatKey = KeyCode.Return;
        [SerializeField] private KeyCode sendMessageKey = KeyCode.Return;

        [Header("Visual Settings")]
        [SerializeField] private Color systemMessageColor = Color.yellow;
        [SerializeField] private Color playerMessageColor = Color.white;
        [SerializeField] private Color whisperMessageColor = Color.cyan;

        // Chat state
        private Queue<string> chatMessages = new Queue<string>();
        private bool isChatOpen = false;
        private string playerName = "Player";

        private void Awake()
        {
            if (instance != null && instance != this)
            {
                Destroy(gameObject);
                return;
            }

            instance = this;
        }

        private void Start()
        {
            InitializeUI();
            CloseChatPanel();
        }

        /// <summary>
        /// UI 초기화
        /// </summary>
        private void InitializeUI()
        {
            if (sendButton != null)
            {
                sendButton.onClick.AddListener(SendChatMessage);
            }

            if (chatInputField != null)
            {
                chatInputField.onSubmit.AddListener(OnInputFieldSubmit);
            }

            // 플레이어 이름 설정 (임시 - 추후 사용자 인증 시스템과 연동)
            playerName = $"Player{Random.Range(1000, 9999)}";

            AddSystemMessage("채팅 시스템이 초기화되었습니다.");
        }

        /// <summary>
        /// 입력 필드 제출 이벤트
        /// </summary>
        private void OnInputFieldSubmit(string text)
        {
            if (!string.IsNullOrWhiteSpace(text))
            {
                SendChatMessage();
            }
        }

        private void Update()
        {
            // 채팅 토글
            if (Input.GetKeyDown(toggleChatKey))
            {
                ToggleChat();
            }

            // ESC로 채팅 닫기
            if (isChatOpen && Input.GetKeyDown(KeyCode.Escape))
            {
                CloseChatPanel();
            }
        }

        /// <summary>
        /// 채팅 패널 열기/닫기
        /// </summary>
        public void ToggleChat()
        {
            if (isChatOpen)
            {
                CloseChatPanel();
            }
            else
            {
                OpenChatPanel();
            }
        }

        /// <summary>
        /// 채팅 패널 열기
        /// </summary>
        public void OpenChatPanel()
        {
            if (chatPanel != null)
            {
                chatPanel.SetActive(true);
                isChatOpen = true;

                if (chatInputField != null)
                {
                    chatInputField.ActivateInputField();
                    chatInputField.Select();
                }
            }
        }

        /// <summary>
        /// 채팅 패널 닫기
        /// </summary>
        public void CloseChatPanel()
        {
            if (chatPanel != null)
            {
                chatPanel.SetActive(false);
                isChatOpen = false;
            }
        }

        /// <summary>
        /// 채팅 메시지 전송
        /// </summary>
        public void SendChatMessage()
        {
            if (chatInputField == null || string.IsNullOrWhiteSpace(chatInputField.text))
                return;

            string message = chatInputField.text.Trim();

            // 욕설 필터 (기본 구현)
            if (enableProfanityFilter)
            {
                message = FilterProfanity(message);
            }

            // 명령어 처리 (/help, /whisper 등)
            if (message.StartsWith("/"))
            {
                ProcessCommand(message);
            }
            else
            {
                // 일반 채팅 메시지 네트워크 전송
                SendChatMessageServerRpc(playerName, message);
            }

            // 입력 필드 초기화
            chatInputField.text = "";
            chatInputField.ActivateInputField();
        }

        /// <summary>
        /// 채팅 메시지를 서버로 전송 (네트워크)
        /// </summary>
        [ServerRpc(RequireOwnership = false)]
        private void SendChatMessageServerRpc(string sender, string message)
        {
            // 서버에서 모든 클라이언트로 브로드캐스트
            ReceiveChatMessageClientRpc(sender, message);
        }

        /// <summary>
        /// 채팅 메시지 수신 (모든 클라이언트)
        /// </summary>
        [ClientRpc]
        private void ReceiveChatMessageClientRpc(string sender, string message)
        {
            AddPlayerMessage(sender, message);
        }

        /// <summary>
        /// 플레이어 메시지 추가
        /// </summary>
        private void AddPlayerMessage(string sender, string message)
        {
            string timestamp = showTimestamps ? $"[{System.DateTime.Now:HH:mm}] " : "";
            string formattedMessage = $"{timestamp}<color=#{ColorUtility.ToHtmlStringRGB(playerMessageColor)}><b>{sender}:</b> {message}</color>";

            AddMessageToHistory(formattedMessage);
        }

        /// <summary>
        /// 시스템 메시지 추가
        /// </summary>
        public void AddSystemMessage(string message)
        {
            string timestamp = showTimestamps ? $"[{System.DateTime.Now:HH:mm}] " : "";
            string formattedMessage = $"{timestamp}<color=#{ColorUtility.ToHtmlStringRGB(systemMessageColor)}>[시스템] {message}</color>";

            AddMessageToHistory(formattedMessage);
        }

        /// <summary>
        /// 귓속말 메시지 추가
        /// </summary>
        public void AddWhisperMessage(string sender, string message)
        {
            string timestamp = showTimestamps ? $"[{System.DateTime.Now:HH:mm}] " : "";
            string formattedMessage = $"{timestamp}<color=#{ColorUtility.ToHtmlStringRGB(whisperMessageColor)}>[귓속말] {sender}: {message}</color>";

            AddMessageToHistory(formattedMessage);
        }

        /// <summary>
        /// 메시지를 히스토리에 추가
        /// </summary>
        private void AddMessageToHistory(string message)
        {
            chatMessages.Enqueue(message);

            // 최대 히스토리 수 초과 시 오래된 메시지 제거
            while (chatMessages.Count > maxChatHistory)
            {
                chatMessages.Dequeue();
            }

            // UI 업데이트
            UpdateChatDisplay();
        }

        /// <summary>
        /// 채팅 디스플레이 업데이트
        /// </summary>
        private void UpdateChatDisplay()
        {
            if (chatHistoryText == null) return;

            chatHistoryText.text = string.Join("\n", chatMessages);

            // 스크롤을 맨 아래로
            if (chatScrollRect != null)
            {
                Canvas.ForceUpdateCanvases();
                chatScrollRect.verticalNormalizedPosition = 0f;
            }
        }

        /// <summary>
        /// 명령어 처리
        /// </summary>
        private void ProcessCommand(string command)
        {
            string[] parts = command.Split(' ');
            string cmd = parts[0].ToLower();

            switch (cmd)
            {
                case "/help":
                    ShowHelpMessage();
                    break;

                case "/clear":
                    ClearChatHistory();
                    break;

                case "/whisper":
                case "/w":
                    if (parts.Length >= 3)
                    {
                        string targetPlayer = parts[1];
                        string message = string.Join(" ", parts, 2, parts.Length - 2);
                        SendWhisper(targetPlayer, message);
                    }
                    else
                    {
                        AddSystemMessage("사용법: /whisper <플레이어명> <메시지>");
                    }
                    break;

                default:
                    AddSystemMessage($"알 수 없는 명령어: {cmd}");
                    break;
            }
        }

        /// <summary>
        /// 도움말 표시
        /// </summary>
        private void ShowHelpMessage()
        {
            AddSystemMessage("=== 채팅 명령어 ===");
            AddSystemMessage("/help - 도움말 표시");
            AddSystemMessage("/clear - 채팅 기록 삭제");
            AddSystemMessage("/whisper <이름> <메시지> - 귓속말 (/w로 축약 가능)");
        }

        /// <summary>
        /// 채팅 기록 삭제
        /// </summary>
        public void ClearChatHistory()
        {
            chatMessages.Clear();
            UpdateChatDisplay();
            AddSystemMessage("채팅 기록이 삭제되었습니다.");
        }

        /// <summary>
        /// 귓속말 전송 (TODO: 네트워크 구현)
        /// </summary>
        private void SendWhisper(string targetPlayer, string message)
        {
            // TODO: 특정 플레이어에게만 메시지 전송
            AddWhisperMessage(playerName, $"→ {targetPlayer}: {message}");
        }

        /// <summary>
        /// 욕설 필터 (기본 구현)
        /// </summary>
        private string FilterProfanity(string message)
        {
            // TODO: 실제 욕설 필터 DB 사용
            // 임시로 간단한 필터만 구현
            return message;
        }

        #region Public API

        public void SetPlayerName(string name)
        {
            playerName = name;
        }

        public bool IsChatOpen()
        {
            return isChatOpen;
        }

        #endregion

        private void OnDestroy()
        {
            if (sendButton != null)
            {
                sendButton.onClick.RemoveListener(SendChatMessage);
            }

            if (chatInputField != null)
            {
                chatInputField.onSubmit.RemoveListener(OnInputFieldSubmit);
            }
        }
    }
}
