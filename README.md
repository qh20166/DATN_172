# GIẢI PHÁP PHÂN TÍCH TÌNH TRẠNG GIAO THÔNG DỰA TRÊN KỸ THUẬT GOM CỤM DỮ LIỆU

**TraffiGo** - Hệ thống phân tích và dự báo lưu lượng giao thông sử dụng Clustering & Machine Learning, Web Backend và Web Frontend

---

## Thông Tin Đồ Án

| Thông Tin | Chi Tiết |
|-----------|---------|
| **Tên Đề Tài** | Giải Pháp Phân Tích Tình Trạng Giao Thông Dựa Trên Kỹ Thuật Gom Cụm Dữ Liệu |
| **Năm** | 2026 |
| **Loại** | Đồ Án Tốt Nghiệp |
| **Mã Đề Tài** | 172 |

### Nhóm Thực Hiện

**Sinh Viên:**
- **Mai Huy Hiệp** (2211045)
- **Nguyễn Quang Hưng** (2211369)
- **Trần Quang Huy** (2211288)
- **Đoàn Công Hải** (2210878)

**Cán Bộ Hướng Dẫn:**
- **PGS.TS. Trần Minh Quang** (Hướng Dẫn 1)
- **ThS. Bùi Tiến Đức** (Hướng Dẫn 2)

---

## Mục Lục

- [Giới Thiệu](#giới-thiệu)
- [Cấu Trúc Dự Án](#cấu-trúc-dự-án)
- [Công Nghệ Sử Dụng](#công-nghệ-sử-dụng)
- [Yêu Cầu Hệ Thống](#yêu-cầu-hệ-thống)
- [Cài Đặt](#cài-đặt)
- [Sử Dụng](#sử-dụng)
- [Cấu Trúc Thư Mục Chi Tiết](#cấu-trúc-thư-mục-chi-tiết)

---

## Giới Thiệu

**DATN_172** là một dự án toàn diện về **phân tích và dự báo lưu lượng giao thông** sử dụng các kỹ thuật gom cụm dữ liệu (Clustering) và Machine Learning. Dự án bao gồm:

-  **Backend/ML Model**: Python - Xử lý dữ liệu, Clustering và Machine Learning
-  **Data Processing**: Tiền xử lý, làm sạch và phân tích dữ liệu giao thông
-  **Web Backend**: Node.js/Express - API, xác thực, xử lý logic nghiệp vụ và tích hợp dữ liệu
-  **Web Frontend**: React/Vite - Giao diện web cho bản đồ, phân tích và tương tác người dùng
-  **Mobile App**: Android Studio (Java) - Ứng dụng di động cho người dùng cuối

### Mục Tiêu

Xây dựng một hệ thống thông minh để:
1. Thu thập dữ liệu giao thông từ các API bên thứ ba (TomTom, HERE, Mapbox)
2. Phân nhóm (clustering) các đoạn đường có đặc tính tương tự
3. Dự báo tình trạng giao thông trong tương lai
4. Cung cấp giao diện di động thân thiện cho người dùng

### Kiến Trúc Hệ Thống

| Thành Phần | Công Nghệ | Mục Đích |
|-----------|-----------|---------|
| **Backend ML** | Python (DATN/) | Xây dựng, huấn luyện, và triển khai mô hình ML & Clustering |
| **Data Processing** | Python (DATA/) | Tiền xử lý dữ liệu, làm sạch, phân tích EDA, thu thập dữ liệu |
| **Web Backend** | Node.js/Express (DATN_BE/) | Cung cấp API, xác thực người dùng, xử lý nghiệp vụ và tích hợp dữ liệu |
| **Web Frontend** | React/Vite (DATN_FE/) | Giao diện web hiển thị bản đồ, phân tích và điều hướng người dùng |
| **Mobile App** | Android Studio/Java (TraffiGo/) | Giao diện di động cho người dùng cuối |

---

## Cấu Trúc Dự Án

```
DATN_172/
│
├── DATN/── Model 2
|    |           ├── data.csv
|    |           ├── main2.py
|    |           └── main2_figure/
|    |
|   Model 1
│   ├── clustering.py
│   ├── config.py
│   ├── data.csv
│   ├── feature_selection.py
│   ├── io_utils.py
│   ├── main.py
│   ├── preprocessing.py
│   ├── reporting.py
│   ├── rule_based.py
│   ├── traffic.py
│   └── processed/
│
│
│
├── DATA/                          # Data Processing & Datasets
│   ├── main.py                    # Script xử lý dữ liệu chính
│   ├── README.md                  # Hướng dẫn về dataset
│   ├── data/                      # Thư mục chứa raw datasets
│   ├── src/                       # Code xử lý dữ liệu bổ sung
│   │   ├── f.py                   # Orchestrator - quản lý khóa API & lập lịch
│   │   └── h.py                   # Data Collector - thu thập dữ liệu động/tĩnh
│   └── DATN/                      # Tài liệu/config liên quan
│
├── DATN_BE/                       # Web Backend - Node.js/Express API
│   ├── src/                        # Source code backend
│   │   ├── controllers/            # Xử lý request/response
│   │   ├── routes/                 # Định nghĩa API routes
│   │   ├── services/               # Logic nghiệp vụ và truy xuất dữ liệu
│   │   ├── middlewares/            # Middleware xác thực, logging, caching
│   │   ├── config/                 # Kết nối CSDL và cấu hình hệ thống
│   │   └── index.js                # Entry point của backend
│   ├── Dockerfile                  # Cấu hình build/deploy Docker
│   ├── fly.toml                    # Cấu hình triển khai Fly.io
│   └── postman_collection.json     # Bộ test API bằng Postman

├── DATN_FE/                       # Web Frontend - React/Vite
│   ├── src/                        # Source code giao diện
│   │   ├── components/             # Thành phần UI tái sử dụng
│   │   ├── pages/                  # Các màn hình/chức năng chính
│   │   ├── context/                # Quản lý state toàn cục
│   │   ├── hooks/                  # Custom hooks
│   │   ├── services/               # Gọi API và xử lý dữ liệu
│   │   └── main.jsx                # Entry point của frontend
│   ├── public/                     # Tài nguyên tĩnh
│   ├── index.html                  # File HTML gốc
│   └── vite.config.js              # Cấu hình Vite

├── TraffiGo/                      # Mobile App - Android Studio
│   ├── app/                       # Module ứng dụng Android
│   ├── gradle/                    # Gradle wrapper scripts
│   ├── build.gradle.kts           # Build configuration (root)
│   ├── settings.gradle.kts        # Gradle settings
│   ├── gradle.properties          # Gradle properties
│   ├── gradlew                    # Gradle wrapper (Linux/macOS)
│   ├── gradlew.bat                # Gradle wrapper (Windows)
│   └── .idea/                     # Android Studio configuration
│
└── README.md                      # File này
```

---

## Công Nghệ Sử Dụng

### Backend & Machine Learning

- **Python 3.8+**
- **NumPy, Pandas** - Xử lý dữ liệu số
- **Scikit-learn** - Machine Learning algorithms (K-Means, DBSCAN, PCA, etc)
- **Matplotlib, Seaborn** - Trực quan hóa dữ liệu
- **Asyncio, aiohttp** - Xử lý bất đồng bộ, gọi API đa luồng
- **API bên thứ ba**: TomTom, HERE Maps, Mapbox, OpenStreetMap (Overpass)

### Data Collection

- **TomTom API** - Lưu lượng giao thông thời gian thực
- **HERE Router API** - Thông tin tuyến đường
- **Mapbox Directions & Map Matching** - Đường đi và độ tin cậy
- **Overpass API** - Dữ liệu OpenStreetMap (đặc tính đường)

### Mobile Application

- **Java** - Ngôn ngữ lập trình chính
- **Android SDK** - Framework phát triển
- **Gradle** - Build automation
- **Android Studio** - IDE chính thức

---

## Yêu Cầu Hệ Thống

### Backend & Data Processing

- Python 3.8 trở lên
- pip (Python Package Manager)
- Virtual Environment (venv)

### API Keys

Để chạy phần Data Collection, bạn cần cấp khóa API:
- **TomTom API Key** - Thu thập dữ liệu giao thông
- **HERE API Key** - Lấy thông tin đường
- **Mapbox Access Token** - Routing và map matching

### Mobile Development

- Android Studio 4.0+
- JDK 11+ (hoặc JDK 8 tối thiểu)
- Android SDK
- Gradle 7.0+
- Emulator hoặc thiết bị Android để test

### Chung

- Git
- 4GB RAM tối thiểu
- 2GB dung lượng ổ cứng (không tính dataset)

---

## Cài Đặt

### 1. Clone Repository

```bash
git clone https://github.com/qh20166/DATN_172.git
cd DATN_172
```

### 2. Setup Backend/ML (DATN)

```bash
# Vào thư mục backend
cd DATN

# Tạo virtual environment
python -m venv venv

# Kích hoạt virtual environment
# Trên Windows:
venv\Scripts\activate
# Trên macOS/Linux:
source venv/bin/activate

# Cài đặt dependencies (nếu có requirements.txt)
# pip install -r requirements.txt
```

### 3. Setup Data Processing (DATA)

```bash
cd ../DATA

# Dữ liệu thô nên được đặt trong thư mục data/
# Dataset được xử lý bằng Python scripts

# Cấu hình .env với API Keys
cat > .env << EOF
TOMTOM_KEY=your_tomtom_key_here
HERE_KEY=your_here_key_here
MAPBOX_KEY=your_mapbox_key_here
EOF
```

### 4. Setup Web Backend (DATN_BE)

```bash
cd ../DATN_BE

# Cài dependencies
npm install

# Chạy backend ở chế độ development
npm run dev
```

### 5. Setup Web Frontend (DATN_FE)

```bash
cd ../DATN_FE

# Cài dependencies
npm install

# Chạy frontend ở chế độ development
npm run dev
```

### 6. Setup Mobile App (TraffiGo)

#### Cách 1: Mở trong Android Studio

```bash
cd ../TraffiGo

# Mở thư mục TraffiGo bằng Android Studio
# File > Open > chọn thư mục TraffiGo
```

#### Cách 2: Build từ Command Line

```bash
cd TraffiGo

# Build debug APK
./gradlew assembleDebug

# Chạy trên emulator hoặc device
./gradlew installDebug

# Hoặc build release
./gradlew assembleRelease
```

---

## Sử Dụng

### Chạy Thu Thập Dữ Liệu

#### 1 Thu Thập Dữ Liệu Tĩnh (Static Data)

```bash
cd DATA

cd src

# Thu thập dữ liệu tĩnh (đặc tính không thay đổi của đường)
python src/h.py static
```

#### 2 Thu Thập Dữ Liệu Động (Dynamic Data)

```bash
# Thu thập dữ liệu động thời gian thực
python src/h.py dynamic
```

#### 3 Chạy Tự Động (Auto Mode - Mỗi 15 phút)

```bash
# Chạy orchestrator (quản lý khóa API & định kỳ 15 phút)
python src/f.py
```

**Hoặc chạy một lần:**

```bash
python src/f.py dynamic
```

### Chạy ML Model

```bash
cd DATN

# Kích hoạt virtual environment
source venv/bin/activate  # macOS/Linux
# hoặc
venv\Scripts\activate    # Windows

# Chạy model chính
python main.py
```

### Chạy Web Backend

```bash
cd DATN_BE

# Chạy server API
npm run dev
```

### Chạy Web Frontend

```bash
cd DATN_FE

# Chạy giao diện web
npm run dev
```

### Xử Lý Dữ Liệu

```bash
cd DATA

# Xử lý dataset
python main.py
```

### Chạy Mobile App

**Sử dụng Android Studio:**

1. Mở TraffiGo/ trong Android Studio
2. Kết nối thiết bị Android hoặc khởi động emulator
3. Chọn Run > Run 'app'

**Sử dụng Command Line:**

```bash
cd TraffiGo

# Build và chạy
./gradlew run

# Hoặc install APK
./gradlew installDebug
adb shell am start -n com.traffigo/.MainActivity
```

---

## Cấu Trúc Thư Mục Chi Tiết

### DATN/ - Backend & ML Model
#  Model 1 – Feature Selection

Model 1 nghiên cứu ảnh hưởng của việc lựa chọn đặc trưng đối với chất lượng phân cụm.

## Quy trình

```text
Dữ liệu
    ↓
Preprocessing
    ↓
Feature Selection
(Random Forest + Mutual Information)
    ↓
Clustering
    ↓
Evaluation
```

## Chức năng các tệp

### preprocessing.py

Tiền xử lý dữ liệu:

* Làm sạch dữ liệu.
* Xử lý giá trị thiếu.
* Loại bỏ thuộc tính phương sai thấp.
* Loại bỏ thuộc tính tương quan cao.
* Chuẩn hóa dữ liệu.

### feature_selection.py

Lựa chọn đặc trưng bằng:

* Random Forest Importance
* Mutual Information

### clustering.py

Triển khai các thuật toán:

* KMeans
* MiniBatchKMeans
* Gaussian Mixture Model (GMM)
* DBSCAN
* Agglomerative Clustering

### reporting.py

Sinh báo cáo đánh giá:

* Silhouette Score
* Davies-Bouldin Index
* Calinski-Harabasz Index

### main.py

Điều khiển toàn bộ pipeline của Model 1.

---

#  Model 2 – Hyperparameter Optimization

Model 2 sử dụng toàn bộ tập đặc trưng sau tiền xử lý và tập trung vào việc tìm kiếm tham số tối ưu cho từng thuật toán.

## Quy trình

```text
Dữ liệu
    ↓
Preprocessing
    ↓
Tìm tham số tối ưu
    ↓
Clustering
    ↓
Evaluation
```

## Nội dung

### main2.py

Thực hiện:

* Elbow Method cho KMeans và MiniBatchKMeans.
* AIC/BIC cho Gaussian Mixture Model.
* Tìm eps cho DBSCAN.
* Chạy mô hình với tham số tối ưu.
* So sánh kết quả giữa các thuật toán.

### main2_figure/

Lưu trữ các hình ảnh kết quả:

* Elbow Curve
* AIC/BIC Curve
* PCA Visualization
* Cluster Distribution
* Radar Chart
* Evaluation Charts

---

# Các Thuật Toán Sử Dụng

## Clustering Algorithms

* KMeans
* MiniBatchKMeans
* Gaussian Mixture Model (GMM)
* DBSCAN
* Agglomerative Clustering

## Feature Selection Methods

* Random Forest Feature Importance
* Mutual Information

## Dimensionality Reduction

* PCA (Principal Component Analysis)

---

# Đánh Giá Mô Hình

## Internal Evaluation

* Silhouette Score
* Davies-Bouldin Index
* Calinski-Harabasz Index

## Relative Evaluation

* PCA Visualization
* Cluster Distribution
* Radar Analysis

---

# Cách Chạy Chương Trình

## Model 1

```bash
cd "Model 1"

python3 main.py
```

## Model 2

```bash
cd "Model 2"

python3 main2.py
```

---

# Kết Quả Đầu Ra

Sau khi chạy chương trình, hệ thống sinh ra:

* Dữ liệu sau tiền xử lý.
* Kết quả phân cụm.
* Các chỉ số đánh giá mô hình.
* PCA Visualization.
* Cluster Distribution.
* Radar Analysis.
* Các biểu đồ đánh giá phục vụ phân tích và so sánh mô hình.

---

### DATN_BE/ - Web Backend

- **src/index.js**: Entry point khởi tạo Express server
- **src/routes/**: Định tuyến các API cho traffic, ML, decision và auth
- **src/controllers/**: Xử lý request/response cho từng nhóm API
- **src/services/**: Logic nghiệp vụ, tương tác dữ liệu và mô hình
- **src/middlewares/**: Auth, logging, caching, upload và error handling
- **src/config/**: Cấu hình database, validation schema và ML models
- **Dockerfile**: Cấu hình container để triển khai backend
- **fly.toml**: Cấu hình triển khai lên Fly.io

### DATN_FE/ - Web Frontend

- **src/main.jsx**: Entry point của React application
- **src/App.jsx**: Component gốc điều phối layout và routing
- **src/pages/**: Các trang chính như login, map, dashboard, analysis
- **src/components/**: UI components dùng lại cho bản đồ, sidebar, form, legend
- **src/context/**: AuthContext và ThemeContext cho state toàn cục
- **src/hooks/**: Custom hooks xử lý dữ liệu traffic và DSS
- **src/services/**: Tầng gọi API và xử lý dữ liệu client-side
- **public/**: Tài nguyên tĩnh, dữ liệu mẫu và các file cấu hình hiển thị

### DATA/ - Data Collection & Management

- **data/**: Thư mục chứa raw datasets (CSV, Excel, etc)
- **src/h.py**: Data Collector - Thu thập dữ liệu tĩnh/động từ APIs
- **src/f.py**: Orchestrator - Quản lý khóa API & lập lịch định kỳ
- **main.py**: Script chính để chạy xử lý dữ liệu
- **README.md**: Tài liệu về datasets

### TraffiGo/ - Android Mobile App

- **app/**: Module chứa source code ứng dụng
  - `src/main/java/`: Code Java
  - `src/main/res/`: Resource (layout, drawable, string, etc)
  - `AndroidManifest.xml`: Cấu hình ứng dụng
- **gradle/**: Gradle wrapper scripts
- **build.gradle.kts**: Cấu hình build cho project
- **settings.gradle.kts**: Cấu hình Gradle settings

---

## Testing

### Test Backend Models

```bash
cd DATN

# Chạy tests (nếu có)
# python -m pytest tests/
```

### Test Mobile App

```bash
cd TraffiGo

# Chạy unit tests Android
./gradlew testDebugUnitTest

# Chạy instrumented tests
./gradlew connectedAndroidTest
```

---

## Tài Liệu Bổ Sung

- [DATA/README.md](DATA/README.md) - Thông tin về datasets và API
- [DATN_BE/ML_README.md](DATN_BE/ML_README.md) - Tài liệu liên quan backend và ML integration
- [DATN_BE/postman_collection.json](DATN_BE/postman_collection.json) - Bộ test API
- [DATN_FE/package.json](DATN_FE/package.json) - Cấu hình và scripts của frontend web
- DATN/config.py - Cấu hình mô hình ML
- TraffiGo/app/ - Android app source code

---



**Năm Học**: 2025-2026
