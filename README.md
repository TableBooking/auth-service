# TableBooking Auth Service

NestJS 12 + TypeScript ESM, Node.js 24 LTS (>=24.15), TypeORM + PostgreSQL. Auth sở hữu tài khoản,
mật khẩu, role và refresh session. Chạy độc lập, không cần checkout source Gateway.
Gateway kết nối tới Auth ở cổng 3001, giữ nguyên `/api`, RS256,
`iss=restaurant-auth`, `aud=restaurant-api`, `sub` UUID.

## Cấu trúc source

```text
src/
├── config/                  # Env validation, DataSource, cấu hình TypeORM
├── constants/               # Role, metadata keys, cookie path, lock ID
├── controllers/             # Nhận HTTP request, gọi service, trả response
├── core/
│   ├── app.module.ts        # Nest DI và module gốc
│   ├── database.service.ts  # Transaction và lifecycle DataSource
│   ├── decorators/          # @Public, @Roles
│   ├── filters/             # Error envelope chung
│   ├── guards/              # Xác minh JWT/Origin, áp dụng policies
│   └── types/               # AuthRequest
├── database/
│   ├── migrations/          # Migration TypeORM có up/down, timestamp
│   └── legacy-schema.ts     # Kiểm tra schema local cũ trước khi tiếp nhận
├── dto/                     # Input schema và type, từ chối field ngoài allowlist
├── entities/                # UserEntity, RefreshSessionEntity, mapping DB
├── factories/               # Tạo User/session hợp lệ; không tự ghi DB
├── middleware/              # Request ID, logging, rate limit
├── policies/                # Role/active account và bảo vệ manager cuối cùng
├── repositories/            # QueryBuilder/Repository TypeORM, khóa DB
├── routes/                  # Tên route được controllers sử dụng
├── services/                # Auth, Users, JWT, password, refresh cookie
├── utils/                   # Hash token, map public user, validation helper
├── cli/                     # Bootstrap manager qua lệnh quản trị
├── bootstrap.ts             # Lắp HTTP middleware và khởi tạo app
└── main.ts                  # Listen/shutdown
```

Luồng xử lý: route → controller → service → repository → entity/database.
Controller không query SQL; service điều phối transaction qua EntityManager và áp dụng policy;
repository truy cập DB; factory khởi tạo entity. `policies/` là folder chứa quy tắc phân quyền.
NestJS dùng controller decorators để đăng ký route; không tạo thêm Express router riêng.

## Database và migration do người chạy kiểm soát

Ứng dụng **không tự tạo database**, không tự tạo/sửa bảng khi start:
`synchronize: false`, `migrationsRun: false`. TypeORM CLI chỉ cần `DATABASE_URL`, không cần JWT key.

Chọn PostgreSQL đã cài và tự tạo database `auth_db` bằng pgAdmin/psql, sau đó chỉnh
`DATABASE_URL` theo [.env.example](.env.example). Ví dụ SQL chạy bằng tài khoản quản trị:

```sql
CREATE DATABASE auth_db;
```

Hoặc dùng PostgreSQL Docker local qua lệnh `docker compose up -d --wait postgres`.
**Docker image tạo `auth_db` ở lần khởi tạo volume đầu tiên** theo `POSTGRES_DB`, không phải app Auth.
Database trên cổng 5433 ở phiên làm việc trước là DB Docker local do agent khởi động để test;
không phải xác nhận bạn đã tạo PostgreSQL thủ công. Dữ liệu cũ vẫn được giữ nguyên.

Sau khi có database và URL kết nối đúng:

```powershell
npm ci
npm run migration:show
npm run migration:run
npm start
```

Các lệnh migration tự build source trước khi gọi TypeORM CLI:

| Lệnh                                                               | Tác dụng                                                           |
| ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `npm run migration:show`                                           | Xem migration đã chạy/chưa chạy                                    |
| `npm run migration:run`                                            | Chạy migration chưa áp dụng, trong transaction                     |
| `npm run migration:revert`                                         | Chạy down của migration gần nhất                                   |
| `npm run migration:create -- src/database/migrations/AddFeature`   | Tạo file migration trống để tự viết up/down                        |
| `npm run migration:generate -- src/database/migrations/AddFeature` | Sinh migration từ khác biệt entities/DB; review file trước khi run |

Migration được lưu lịch sử ở bảng `typeorm_migrations`:

1. [CreateUsers](src/database/migrations/1794300000000-CreateUsers.ts): users, role check, email unique.
2. [CreateRefreshSessions](src/database/migrations/1794300001000-CreateRefreshSessions.ts): session, FK, index.

Không sửa migration đã áp dụng để thay schema; tạo migration mới. Các lệnh create/generate tạo
file, chưa áp dụng vào DB. Chỉ chạy một migration job tại một thời điểm trong deployment.
Wrapper của lệnh create/generate chuẩn hóa `import type` và format file vừa sinh để tương thích
TypeScript strict/ESM của dự án; không thay đổi các migration đã có.
`migration:revert` của baseline mới sẽ xóa bảng tương ứng, chỉ dùng khi chủ động rollback DB trống/test.

Với schema local từ phiên bản trước: migration chỉ tiếp nhận nếu marker `schema_migrations`
và cấu trúc bảng/constraint phù hợp, giữ dữ liệu, ghi nhận lịch sử TypeORM. Schema lạ sẽ bị
từ chối và rollback. Revert baseline đã tiếp nhận từ legacy bị chặn để bảo vệ dữ liệu cũ.
Hai bảng lịch sử có thể cùng tồn tại; về sau chỉ TypeORM theo dõi migration mới.

## Chạy toàn bộ tích hợp local

Yêu cầu Docker Desktop, Node.js 24 và image Gateway đã có local hoặc trên registry.
Auth sở hữu private key tại `keys/auth-private.pem`; container chỉ mount private key đó.
Auth suy ra public key trong bộ nhớ để tự xác minh JWT, không đọc file public key.
`keys/auth-public.pem` là bản xuất để cung cấp cho Gateway/các service khác.
Không commit thư mục keys và không đưa key vào Docker image.

```powershell
npm ci
Copy-Item .env.example .env
# Chỉ chạy khi chưa có key. Nếu đã có, provision private key hiện có vào keys/.
npm run keys:generate
docker compose up -d --wait postgres
docker compose build auth
docker compose run --rm migrate
# Auth độc lập, không cần Gateway:
docker compose up -d --wait auth
# Tùy chọn: đặt GATEWAY_IMAGE trong .env thành image Gateway local/registry của bạn.
docker compose -f compose.yaml -f compose.gateway.yaml up -d --wait
npm run smoke:gateway
```

- Gateway: <http://localhost:8081/api/health>
- Auth: <http://localhost:3001/health/ready>
- PostgreSQL: localhost:5433, database `auth_db`.
- Frontend gọi `http://localhost:8081/api/...`, dùng `credentials: 'include'`.
- Origin cho refresh/logout: `http://localhost:5173` hoặc `http://localhost:8081`.

Cổng Gateway 8081 được chọn vì 8080 trên máy hiện tại đang chạy ứng dụng khác.
[Compose chính](compose.yaml) chỉ có Auth/PostgreSQL và migration tool.
[Compose Gateway tùy chọn](compose.gateway.yaml) dùng `image`, không có build context bên ngoài.
Gateway dùng `AUTH_SERVICE_URL=http://auth:3001` qua DNS Docker của cùng Compose project.
Image mẫu `tablebooking-gateway:auth-integration` chỉ là tag local đã có trên máy phát triển;
máy khác phải đặt `GATEWAY_IMAGE` thành tag có thật trong local/registry.
`GATEWAY_PORT` có thể đổi cổng publish; nếu dùng origin mới, cập nhật allowlist ở cả hai service.
Booking/Operations/Tracking/Notification chưa thuộc môi trường tích hợp này.

Nếu Gateway đã chạy trong container khác, không cần khởi động thêm Gateway bằng override.
Hai container cần chung Docker network; ví dụ nối Gateway vào network local của Auth:

```powershell
docker network connect tablebooking-auth_default TEN_CONTAINER_GATEWAY
```

Cấu hình container Gateway `AUTH_SERVICE_URL=http://auth:3001` và mount public key khớp Auth
qua cấu hình triển khai của Gateway, sau đó recreate Gateway nếu thay env/mount. Nếu vẫn muốn
Gateway gọi qua host, dùng `http://host.docker.internal:3001` trên Docker Desktop;
không dùng `localhost:3001` bên trong Gateway vì đó là chính container Gateway.
`GATEWAY_URL` là URL HTTP cho script test trên host, khác URL upstream nội bộ.

Các credential PostgreSQL trong ví dụ/Compose chỉ dành cho local, các cổng chỉ bind loopback.
Production cần secrets riêng, HTTPS, `NODE_ENV=production`, `COOKIE_SECURE=true` và Origin thực tế.
Compose này là cấu hình local, cố ý chạy Auth development để dùng cookie qua HTTP.

## API và RBAC

| Method | Path                               | Quyền                                       |
| ------ | ---------------------------------- | ------------------------------------------- |
| POST   | `/api/auth/register`               | Public, luôn tạo CUSTOMER                   |
| POST   | `/api/auth/login`                  | Public                                      |
| POST   | `/api/auth/refresh`                | Refresh cookie + trusted Origin             |
| POST   | `/api/auth/logout`                 | Refresh cookie + trusted Origin; idempotent |
| POST   | `/api/auth/change-password`        | CUSTOMER / STAFF / MANAGER                  |
| GET    | `/api/users/me`                    | CUSTOMER / STAFF / MANAGER                  |
| PATCH  | `/api/users/me`                    | Chỉ fullName, phone của chính mình          |
| GET    | `/api/users/staff?page=1&limit=20` | MANAGER                                     |
| POST   | `/api/users/staff`                 | MANAGER, luôn tạo STAFF                     |
| PATCH  | `/api/users/{id}/status`           | MANAGER                                     |

Ví dụ đăng nhập qua Gateway:

```http
POST http://localhost:8081/api/auth/login
Content-Type: application/json

{"email":"guest@example.test","password":"your-password"}
```

Response: `{accessToken, tokenType: "Bearer", expiresIn: 900, user}` và cookie
`refresh_session` HttpOnly, SameSite=Lax, Path=/api/auth. Refresh token không nằm trong JSON.
Request bảo vệ gửi `Authorization: Bearer <accessToken>`.
Đổi mật khẩu dùng `{currentPassword, newPassword}` đúng OpenAPI V2.
Không dùng `oldPassword` dù bản hướng dẫn prose có ví dụ tên này.
Lỗi có `{code,message,correlationId,details?}`; correlationId giữ nguyên request ID của Gateway.

Nguồn contract:
[OpenAPI V2](https://github.com/TableBooking/docs/blob/main/restaurant-nestjs-playbook-team/contracts/openapi/restaurant-api-v2.yaml),
[Auth playbook](https://github.com/TableBooking/docs/blob/main/restaurant-nestjs-playbook-team/nguoi-1-auth-gateway/HUONG-DAN.md).

## Tạo manager đầu tiên

Không có public API tạo MANAGER. Sau khi PostgreSQL và migration đã chạy:

```powershell
npm run build
$env:BOOTSTRAP_MANAGER_EMAIL = 'manager@example.test'
$env:BOOTSTRAP_MANAGER_NAME = 'Restaurant Manager'
# Nhập password ẩn; không ghi password thật vào command history hoặc source.
$managerCredential = Read-Host 'Manager password (at least 8 characters)' -AsSecureString
$env:BOOTSTRAP_MANAGER_PASSWORD = [System.Net.NetworkCredential]::new('', $managerCredential).Password
try { npm run bootstrap:manager }
finally { Remove-Item Env:BOOTSTRAP_MANAGER_PASSWORD; $managerCredential = $null }
```

CLI hash password bằng scrypt trước khi lưu; không seed password/hash giả vào SQL.
Email được chuẩn hóa lowercase và unique case-insensitive.
Một user có một role cố định; chưa có quyền động hoặc bảng role-permission.
MANAGER cuối cùng đang active không thể bị khóa.

## Chạy Auth trên host

```powershell
docker compose up -d --wait postgres
npm ci
npm run build
npm run migrate
npm start
```

Không chạy Auth host đồng thời container Auth trên cổng 3001. Khi Gateway cũng chạy trên host,
`AUTH_SERVICE_URL=http://localhost:3001`; dùng cùng public key và issuer/audience như Auth.
`npm run build:watch` biên dịch khi sửa code; chạy `npm run dev` ở terminal thứ hai để restart
process khi output thay đổi. Migration chạy riêng, có version và transaction do TypeORM quản lý.

Nếu chưa có cặp RSA ở bất cứ service nào, dùng `npm run keys:generate` một lần,
sửa đường dẫn key ở env và biến Compose `JWT_PRIVATE_KEY_FILE`/`JWT_PUBLIC_KEY_FILE`.
Lệnh từ chối ghi đè key có sẵn. Không dùng cặp key mới nếu hệ thống đã có key.

## Kiểm thử

```powershell
npm run check
npm test
npm run build
npm run test:gateway
npm run smoke:gateway
```

`npm test` dùng PostgreSQL thật; tự tạo database `auth_test_<uuid>`/`auth_migration_test_<uuid>` rồi xóa sau test.
Tài khoản DB test cần quyền CREATE DATABASE; dùng `TEST_DATABASE_URL` để chỉ định riêng,
hoặc mặc định dùng `DATABASE_URL`. Không truncate database đang chạy. Test dùng RSA tạm,
không đọc private key hệ thống.

`test:gateway` là alias của `smoke:gateway`, gọi HTTP vào Gateway đang chạy qua `GATEWAY_URL`
(mặc định http://localhost:8081). Không import module/build/source của Gateway.
`npm test` kiểm tra 10 API nghiệp vụ Auth, JWT, RBAC và migration độc lập với Gateway.

`smoke:gateway` kiểm tra HTTP thật ở cổng 8081: health, register, login, me, role 403,
thiếu token 401, refresh rotation, logout và refresh sau logout 401.
Mỗi lần smoke để lại một CUSTOMER có email ngẫu nhiên trong DB local; không in token/password.
CI chạy typecheck/format, test PostgreSQL, build và Docker build.

## Thành phần và giới hạn

- [Controllers](src/controllers/): 10 endpoint, validation/cookie và health.
- [AuthService](src/services/auth.service.ts): login và transaction của session.
- [UsersService](src/services/users.service.ts): tài khoản, hồ sơ và quản lý nhân viên.
- [Entities](src/entities/), [repositories](src/repositories/) và [migrations](src/database/migrations/).
- [Guards](src/core/guards/) xác minh JWT/Origin; [policy](src/policies/account.policy.ts) kiểm tra quyền.
- [DataSource](src/config/database.config.ts) cấu hình TypeORM, không synchronize hoặc auto-migrate.
- [Cấu hình mẫu](.env.example), [Compose Auth](compose.yaml), [Compose Gateway](compose.gateway.yaml), [HTTP smoke](scripts/smoke-gateway.mjs).

Refresh token ngẫu nhiên 256 bit; DB chỉ lưu SHA-256 hash. Mỗi lần refresh khóa user rồi khóa
session, revoke token cũ và tạo token mới trong cùng transaction. Dùng lại token cũ sẽ revoke
cả family, kể cả token thay thế đã cấp. Đổi password/khóa tài khoản revoke mọi refresh session.
Client phải serialize refresh; hai request dùng cùng token được xem là reuse.

Auth kiểm tra trạng thái active từ DB ở các endpoint bảo vệ. Các service khác xác minh access
JWT độc lập nên token đã cấp vẫn có thể còn hiệu lực tối đa 15 phút sau logout/khóa tài khoản;
chưa có distributed revocation list. Domain service vẫn phải kiểm tra ownership tài nguyên.
Auth không cần RabbitMQ cho MVP.

Gateway thực hiện per-client IP rate limit. Auth không tin `X-Forwarded-For`; limiter riêng
tại Auth đếm IP kết nối trực tiếp (các client qua cùng Gateway dùng chung bucket).
Điều chỉnh `AUTH_RATE_LIMIT_MAX` cho lưu lượng triển khai. Không log cookie, password hoặc JWT.
Refresh sessions đã revoke được giữ để phát hiện reuse; cần retention job khi vận hành dài hạn.
