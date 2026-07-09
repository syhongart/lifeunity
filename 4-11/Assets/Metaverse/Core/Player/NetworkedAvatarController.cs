using UnityEngine;
using Unity.Netcode;

namespace Metaverse.Core.Player
{
    /// <summary>
    /// 네트워크 동기화되는 아바타 컨트롤러
    /// 기존 PlayerMove.cs 로직을 네트워크 환경에 맞게 재설계
    /// </summary>
    [RequireComponent(typeof(CharacterController))]
    [RequireComponent(typeof(NetworkObject))]
    public class NetworkedAvatarController : NetworkBehaviour
    {
        [Header("Movement Settings")]
        [SerializeField] private float walkSpeed = 5f;
        [SerializeField] private float runSpeed = 8f;
        [SerializeField] private float jumpForce = 8f;
        [SerializeField] private float gravity = -20f;

        [Header("Camera Settings")]
        [SerializeField] private Camera avatarCamera;
        [SerializeField] private Transform cameraTarget; // 카메라가 따라갈 위치
        [SerializeField] private float mouseSensitivity = 100f;
        [SerializeField] private float verticalLookLimit = 80f;

        [Header("Animation (Optional)")]
        [SerializeField] private Animator animator;

        [Header("Nameplate")]
        [SerializeField] private GameObject nameplatePrefab;
        private GameObject nameplateInstance;

        // Components
        private CharacterController characterController;

        // Movement state
        private Vector3 moveDirection;
        private float yVelocity;
        private bool isGrounded;

        // Camera rotation
        private float verticalRotation = 0f;
        private float horizontalRotation = 0f;

        // Input state (only for local player)
        private float horizontal;
        private float vertical;
        private bool isRunning;
        private bool jumpPressed;

        // Network variables for animation sync
        private NetworkVariable<Vector3> networkPosition = new NetworkVariable<Vector3>();
        private NetworkVariable<Quaternion> networkRotation = new NetworkVariable<Quaternion>();
        private NetworkVariable<float> networkSpeed = new NetworkVariable<float>();

        private void Awake()
        {
            characterController = GetComponent<CharacterController>();
        }

        public override void OnNetworkSpawn()
        {
            base.OnNetworkSpawn();

            if (IsOwner)
            {
                // 로컬 플레이어 설정
                SetupLocalPlayer();
            }
            else
            {
                // 원격 플레이어 설정
                SetupRemotePlayer();
            }

            // 네임플레이트 생성
            CreateNameplate();
        }

        /// <summary>
        /// 로컬 플레이어 초기화
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
                // 카메라가 없으면 메인 카메라 찾기
                avatarCamera = Camera.main;
                if (avatarCamera != null && cameraTarget != null)
                {
                    avatarCamera.transform.SetParent(cameraTarget);
                    avatarCamera.transform.localPosition = Vector3.zero;
                }
            }

            // 커서 잠금
            Cursor.lockState = CursorLockMode.Locked;
            Cursor.visible = false;

            Debug.Log("[NetworkedAvatarController] Local player initialized");
        }

        /// <summary>
        /// 원격 플레이어 초기화
        /// </summary>
        private void SetupRemotePlayer()
        {
            // 원격 플레이어의 카메라 비활성화
            if (avatarCamera != null)
            {
                avatarCamera.gameObject.SetActive(false);
            }

            // CharacterController는 로컬에서만 사용 (원격은 Transform 동기화만)
            if (characterController != null)
            {
                characterController.enabled = false;
            }

            Debug.Log($"[NetworkedAvatarController] Remote player initialized (ID: {OwnerClientId})");
        }

        /// <summary>
        /// 네임플레이트 생성
        /// </summary>
        private void CreateNameplate()
        {
            if (nameplatePrefab != null)
            {
                nameplateInstance = Instantiate(nameplatePrefab, transform);
                // TODO: 사용자 이름 표시 로직
            }
        }

        private void Update()
        {
            if (!IsOwner) return; // 원격 플레이어는 입력 처리 안 함

            HandleInput();
            HandleMovement();
            HandleCameraRotation();
            UpdateAnimations();
        }

        /// <summary>
        /// 입력 처리
        /// </summary>
        private void HandleInput()
        {
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
        }

        /// <summary>
        /// 이동 처리
        /// </summary>
        private void HandleMovement()
        {
            // 땅 체크
            isGrounded = characterController.isGrounded;

            // 이동 방향 계산
            Vector3 forward = transform.forward;
            Vector3 right = transform.right;

            float currentSpeed = isRunning ? runSpeed : walkSpeed;
            moveDirection = (forward * vertical + right * horizontal).normalized * currentSpeed;

            // 점프
            if (isGrounded)
            {
                if (yVelocity < 0)
                    yVelocity = -2f; // 약간의 downforce로 땅에 붙어있게

                if (jumpPressed)
                {
                    yVelocity = jumpForce;
                }
            }

            // 중력 적용
            yVelocity += gravity * Time.deltaTime;
            moveDirection.y = yVelocity;

            // 이동 적용
            characterController.Move(moveDirection * Time.deltaTime);

            // 네트워크 동기화를 위한 위치 업데이트
            UpdateNetworkTransform();
        }

        /// <summary>
        /// 카메라 회전 처리
        /// </summary>
        private void HandleCameraRotation()
        {
            // 마우스 입력
            float mouseX = Input.GetAxis("Mouse X") * mouseSensitivity * Time.deltaTime;
            float mouseY = Input.GetAxis("Mouse Y") * mouseSensitivity * Time.deltaTime;

            // 수직 회전 (카메라)
            verticalRotation -= mouseY;
            verticalRotation = Mathf.Clamp(verticalRotation, -verticalLookLimit, verticalLookLimit);

            if (cameraTarget != null)
            {
                cameraTarget.localRotation = Quaternion.Euler(verticalRotation, 0f, 0f);
            }
            else if (avatarCamera != null)
            {
                avatarCamera.transform.localRotation = Quaternion.Euler(verticalRotation, 0f, 0f);
            }

            // 수평 회전 (캐릭터 몸체)
            horizontalRotation += mouseX;
            transform.rotation = Quaternion.Euler(0f, horizontalRotation, 0f);

            // 네트워크 회전 동기화
            UpdateNetworkRotation();
        }

        /// <summary>
        /// 애니메이션 업데이트
        /// </summary>
        private void UpdateAnimations()
        {
            if (animator == null) return;

            // 이동 속도 계산
            Vector3 horizontalVelocity = new Vector3(characterController.velocity.x, 0, characterController.velocity.z);
            float speed = horizontalVelocity.magnitude;

            // 애니메이터 파라미터 업데이트
            animator.SetFloat("Speed", speed);
            animator.SetBool("IsGrounded", isGrounded);
            animator.SetBool("IsRunning", isRunning);

            // 네트워크 동기화
            UpdateNetworkSpeed(speed);
        }

        #region Network Synchronization

        /// <summary>
        /// 네트워크 위치 동기화
        /// </summary>
        private void UpdateNetworkTransform()
        {
            if (IsServer)
            {
                networkPosition.Value = transform.position;
            }
            else if (IsOwner)
            {
                UpdatePositionServerRpc(transform.position);
            }
        }

        /// <summary>
        /// 네트워크 회전 동기화
        /// </summary>
        private void UpdateNetworkRotation()
        {
            if (IsServer)
            {
                networkRotation.Value = transform.rotation;
            }
            else if (IsOwner)
            {
                UpdateRotationServerRpc(transform.rotation);
            }
        }

        /// <summary>
        /// 네트워크 속도 동기화
        /// </summary>
        private void UpdateNetworkSpeed(float speed)
        {
            if (IsServer)
            {
                networkSpeed.Value = speed;
            }
            else if (IsOwner)
            {
                UpdateSpeedServerRpc(speed);
            }
        }

        [ServerRpc]
        private void UpdatePositionServerRpc(Vector3 position)
        {
            networkPosition.Value = position;
        }

        [ServerRpc]
        private void UpdateRotationServerRpc(Quaternion rotation)
        {
            networkRotation.Value = rotation;
        }

        [ServerRpc]
        private void UpdateSpeedServerRpc(float speed)
        {
            networkSpeed.Value = speed;
        }

        #endregion

        #region Public API

        /// <summary>
        /// 특정 위치로 텔레포트
        /// </summary>
        public void Teleport(Vector3 position)
        {
            if (IsOwner && characterController != null)
            {
                characterController.enabled = false;
                transform.position = position;
                characterController.enabled = true;

                UpdateNetworkTransform();
            }
        }

        /// <summary>
        /// 이동 속도 설정
        /// </summary>
        public void SetWalkSpeed(float speed)
        {
            walkSpeed = speed;
        }

        /// <summary>
        /// 달리기 속도 설정
        /// </summary>
        public void SetRunSpeed(float speed)
        {
            runSpeed = speed;
        }

        #endregion

        private void OnDestroy()
        {
            if (nameplateInstance != null)
            {
                Destroy(nameplateInstance);
            }
        }
    }
}
