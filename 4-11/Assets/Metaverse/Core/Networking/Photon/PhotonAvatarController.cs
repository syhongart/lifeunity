using UnityEngine;

// NOTE: Photon PUN2를 Asset Store에서 설치한 후 아래 주석을 해제하세요
// using Photon.Pun;

namespace Metaverse.Core.Networking.Photon
{
    /// <summary>
    /// Photon 네트워크 동기화 아바타 컨트롤러
    /// WebGL, 모바일, PC 모두 지원
    /// </summary>
    [RequireComponent(typeof(CharacterController))]
    public class PhotonAvatarController : MonoBehaviour // MonoBehaviourPun으로 변경
    {
        [Header("Movement Settings")]
        [SerializeField] private float walkSpeed = 5f;
        [SerializeField] private float runSpeed = 8f;
        [SerializeField] private float jumpForce = 8f;
        [SerializeField] private float gravity = -20f;

        [Header("Camera Settings")]
        [SerializeField] private Camera avatarCamera;
        [SerializeField] private Transform cameraTarget;
        [SerializeField] private float mouseSensitivity = 100f;
        [SerializeField] private float touchSensitivity = 0.5f; // 모바일
        [SerializeField] private float verticalLookLimit = 80f;

        [Header("Mobile Controls (Optional)")]
        [SerializeField] private GameObject mobileJoystick; // 모바일 조이스틱 UI

        [Header("Animation (Optional)")]
        [SerializeField] private Animator animator;

        // Components
        private CharacterController characterController;

        // Movement state
        private Vector3 moveDirection;
        private float yVelocity;
        private bool isGrounded;

        // Camera rotation
        private float verticalRotation = 0f;
        private float horizontalRotation = 0f;

        // Input state
        private float horizontal;
        private float vertical;
        private bool isRunning;
        private bool jumpPressed;

        private void Awake()
        {
            characterController = GetComponent<CharacterController>();
        }

        private void Start()
        {
            /* Photon 설치 후 주석 해제:

            if (photonView.IsMine)
            {
                SetupLocalPlayer();
            }
            else
            {
                SetupRemotePlayer();
            }

            */

            // 임시 (Photon 미설치 시 - 로컬 플레이어로 동작)
            SetupLocalPlayer();
        }

        /// <summary>
        /// 로컬 플레이어 설정
        /// </summary>
        private void SetupLocalPlayer()
        {
            // 카메라 활성화
            if (avatarCamera != null)
            {
                avatarCamera.gameObject.SetActive(true);
            }
            else
            {
                avatarCamera = Camera.main;
                if (avatarCamera != null && cameraTarget != null)
                {
                    avatarCamera.transform.SetParent(cameraTarget);
                    avatarCamera.transform.localPosition = Vector3.zero;
                }
            }

            // 모바일 감지 및 조이스틱 활성화
#if UNITY_ANDROID || UNITY_IOS || UNITY_WEBGL_MOBILE
            if (mobileJoystick != null)
            {
                mobileJoystick.SetActive(true);
            }
#else
            if (mobileJoystick != null)
            {
                mobileJoystick.SetActive(false);
            }

            // PC에서는 커서 잠금
            Cursor.lockState = CursorLockMode.Locked;
            Cursor.visible = false;
#endif

            Debug.Log("[PhotonAvatarController] Local player initialized");
        }

        /// <summary>
        /// 원격 플레이어 설정
        /// </summary>
        private void SetupRemotePlayer()
        {
            // 원격 플레이어의 카메라 비활성화
            if (avatarCamera != null)
            {
                avatarCamera.gameObject.SetActive(false);
            }

            // CharacterController는 로컬에서만 사용
            if (characterController != null)
            {
                characterController.enabled = false;
            }

            // 모바일 조이스틱 비활성화
            if (mobileJoystick != null)
            {
                mobileJoystick.SetActive(false);
            }

            Debug.Log("[PhotonAvatarController] Remote player initialized");
        }

        private void Update()
        {
            /* Photon 설치 후 주석 해제:
            if (!photonView.IsMine) return; // 원격 플레이어는 입력 처리 안 함
            */

            HandleInput();
            HandleMovement();
            HandleCameraRotation();
            UpdateAnimations();
        }

        /// <summary>
        /// 입력 처리 (PC + 모바일)
        /// </summary>
        private void HandleInput()
        {
#if UNITY_ANDROID || UNITY_IOS
            // 모바일: 가상 조이스틱 사용
            // TODO: 실제 조이스틱 에셋 연동
            horizontal = Input.GetAxis("Horizontal");
            vertical = Input.GetAxis("Vertical");
#else
            // PC: 키보드
            horizontal = Input.GetAxis("Horizontal");
            vertical = Input.GetAxis("Vertical");
            isRunning = Input.GetKey(KeyCode.LeftShift);
            jumpPressed = Input.GetButtonDown("Jump");

            // ESC로 커서 해제
            if (Input.GetKeyDown(KeyCode.Escape))
            {
                Cursor.lockState = CursorLockMode.None;
                Cursor.visible = true;
            }

            // 마우스 클릭으로 다시 잠금
            if (Input.GetMouseButtonDown(0))
            {
                Cursor.lockState = CursorLockMode.Locked;
                Cursor.visible = false;
            }
#endif
        }

        /// <summary>
        /// 이동 처리
        /// </summary>
        private void HandleMovement()
        {
            isGrounded = characterController.isGrounded;

            Vector3 forward = transform.forward;
            Vector3 right = transform.right;

            float currentSpeed = isRunning ? runSpeed : walkSpeed;
            moveDirection = (forward * vertical + right * horizontal).normalized * currentSpeed;

            // 점프
            if (isGrounded)
            {
                if (yVelocity < 0)
                    yVelocity = -2f;

                if (jumpPressed)
                {
                    yVelocity = jumpForce;
                }
            }

            yVelocity += gravity * Time.deltaTime;
            moveDirection.y = yVelocity;

            characterController.Move(moveDirection * Time.deltaTime);
        }

        /// <summary>
        /// 카메라 회전 (PC: 마우스, 모바일: 터치)
        /// </summary>
        private void HandleCameraRotation()
        {
#if UNITY_ANDROID || UNITY_IOS
            // 모바일: 터치 스와이프
            if (Input.touchCount > 0)
            {
                Touch touch = Input.GetTouch(0);

                // 오른쪽 절반 화면만 카메라 회전
                if (touch.position.x > Screen.width / 2)
                {
                    float touchX = touch.deltaPosition.x * touchSensitivity;
                    float touchY = touch.deltaPosition.y * touchSensitivity;

                    verticalRotation -= touchY;
                    verticalRotation = Mathf.Clamp(verticalRotation, -verticalLookLimit, verticalLookLimit);

                    horizontalRotation += touchX;
                }
            }
#else
            // PC: 마우스
            float mouseX = Input.GetAxis("Mouse X") * mouseSensitivity * Time.deltaTime;
            float mouseY = Input.GetAxis("Mouse Y") * mouseSensitivity * Time.deltaTime;

            verticalRotation -= mouseY;
            verticalRotation = Mathf.Clamp(verticalRotation, -verticalLookLimit, verticalLookLimit);

            horizontalRotation += mouseX;
#endif

            // 카메라 수직 회전
            if (cameraTarget != null)
            {
                cameraTarget.localRotation = Quaternion.Euler(verticalRotation, 0f, 0f);
            }
            else if (avatarCamera != null)
            {
                avatarCamera.transform.localRotation = Quaternion.Euler(verticalRotation, 0f, 0f);
            }

            // 캐릭터 수평 회전
            transform.rotation = Quaternion.Euler(0f, horizontalRotation, 0f);
        }

        /// <summary>
        /// 애니메이션 업데이트
        /// </summary>
        private void UpdateAnimations()
        {
            if (animator == null) return;

            Vector3 horizontalVelocity = new Vector3(characterController.velocity.x, 0, characterController.velocity.z);
            float speed = horizontalVelocity.magnitude;

            animator.SetFloat("Speed", speed);
            animator.SetBool("IsGrounded", isGrounded);
            animator.SetBool("IsRunning", isRunning);
        }

        /* Photon RPC 예시 (Photon 설치 후 주석 해제):

        /// <summary>
        /// 위치 동기화 (RPC)
        /// </summary>
        [PunRPC]
        void SyncPosition(Vector3 position)
        {
            transform.position = position;
        }

        /// <summary>
        /// 회전 동기화 (RPC)
        /// </summary>
        [PunRPC]
        void SyncRotation(Quaternion rotation)
        {
            transform.rotation = rotation;
        }

        */

        #region Public API

        /// <summary>
        /// 텔레포트
        /// </summary>
        public void Teleport(Vector3 position)
        {
            if (characterController != null)
            {
                characterController.enabled = false;
                transform.position = position;
                characterController.enabled = true;
            }
        }

        /// <summary>
        /// 이동 속도 설정
        /// </summary>
        public void SetWalkSpeed(float speed)
        {
            walkSpeed = speed;
        }

        public void SetRunSpeed(float speed)
        {
            runSpeed = speed;
        }

        #endregion

        #region Debug

        private void OnGUI()
        {
            GUIStyle style = new GUIStyle();
            style.fontSize = 12;
            style.normal.textColor = Color.green;
            style.padding = new RectOffset(10, 10, 10, 10);

            /* Photon 설치 후 주석 해제:
            GUI.Label(new Rect(10, 150, 300, 25),
                $"Photon: {(photonView.IsMine ? "LOCAL" : "REMOTE")}", style);
            */

            GUI.Label(new Rect(10, 150, 300, 25),
                $"Speed: {characterController.velocity.magnitude:F1}", style);

#if UNITY_ANDROID || UNITY_IOS
            GUI.Label(new Rect(10, 175, 300, 25), "Platform: MOBILE", style);
#elif UNITY_WEBGL
            GUI.Label(new Rect(10, 175, 300, 25), "Platform: WEBGL", style);
#else
            GUI.Label(new Rect(10, 175, 300, 25), "Platform: PC", style);
#endif
        }

        #endregion
    }
}
