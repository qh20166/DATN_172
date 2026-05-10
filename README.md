# GIẢI PHÁP PHÂN TÍCH TÌNH TRẠNG GIAO THÔNG DỰA TRÊN KỸ THUẬT GOM CỤM DỮ LIỆU

**TraffiGo** - Hệ thống phân tích và dự báo lưu lượng giao thông sử dụng Clustering & Machine Learning

---

## 📚 Thông Tin Đồ Án

| Thông Tin | Chi Tiết |
|-----------|---------|
| **Tên Đề Tài** | Giải Pháp Phân Tích Tình Trạng Giao Thông Dựa Trên Kỹ Thuật Gom Cụm Dữ Liệu |
| **Năm** | 2026 |
| **Loại** | Đồ Án Tốt Nghiệp |
| **Mã Đề Tài** | 172 |

### 👨‍🎓 Nhóm Thực Hiện

**Sinh Viên:**
- **Mai Huy Hiệp** (2211045)
- **Nguyễn Quang Hưng** (2211369)
- **Trần Quang Huy** (2211288)
- **Đoàn Công Hải** (2210878)

**Cán Bộ Hướng Dẫn:**
- **PGS.TS. Trần Minh Quang** (Hướng Dẫn 1)
- **ThS. Bùi Tiến Đức** (Hướng Dẫn 2)

---

## 📋 Mục Lục

- [Giới Thiệu](#giới-thiệu)
- [Cấu Trúc Dự Án](#cấu-trúc-dự-án)
- [Công Nghệ Sử Dụng](#công-nghệ-sử-dụng)
- [Yêu Cầu Hệ Thống](#yêu-cầu-hệ-thống)
- [Cài Đặt](#cài-đặt)
- [Sử Dụng](#sử-dụng)
- [Cấu Trúc Thư Mục Chi Tiết](#cấu-trúc-thư-mục-chi-tiết)

---

## 🎯 Giới Thiệu

**DATN_172** là một dự án toàn diện về **phân tích và dự báo lưu lượng giao thông** sử dụng các kỹ thuật gom cụm dữ liệu (Clustering) và Machine Learning. Dự án bao gồm:

- 🐍 **Backend/ML Model**: Python - Xử lý dữ liệu, Clustering và Machine Learning
- 📊 **Data Processing**: Tiền xử lý, làm sạch và phân tích dữ liệu giao thông
- 📱 **Mobile App**: Android Studio (Java) - Ứng dụng di động cho người dùng cuối

### 🎯 Mục Tiêu

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
| **Mobile App** | Android Studio/Java (TraffiGo/) | Giao diện di động cho người dùng cuối |

---

## 📁 Cấu Trúc Dự Án

```
DATN_172/
│
├── DATN/                          # 🐍 Backend - Machine Learning & API
│   ├── main.py                    # Entry point chính
│   ├── clustering.py              # Thuật toán clustering (K-Means, etc)
│   ├── traffic.py                 # Mô hình dự báo giao thông
│   ├── feature_selection.py       # Lựa chọn đặc trưng
│   ├── preprocessing.py           # Tiền xử lý dữ liệu
│   ├── config.py                  # Cấu hình hệ thống
│   ├── reporting.py               # Tạo report kết quả
│   ├── rule_based.py              # Luật dựa trên heuristic
│   ├── io_utils.py                # Utility input/output
│   ├── data.csv                   # Dữ liệu mẫu
│   └── processed/                 # Thư mục dữ liệu đã xử lý
│
├── DATA/                          # 📊 Data Processing & Datasets
│   ├── main.py                    # Script xử lý dữ liệu chính
│   ├── README.md                  # Hướng dẫn về dataset
│   ├── data/                      # Thư mục chứa raw datasets
│   ├── src/                       # Code xử lý dữ liệu bổ sung
│   │   ├── f.py                   # Orchestrator - quản lý khóa API & lập lịch
│   │   └── h.py                   # Data Collector - thu thập dữ liệu động/tĩnh
│   └── DATN/                      # Tài liệu/config liên quan
│
├── TraffiGo/                      # 📱 Mobile App - Android Studio
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

## 🛠️ Công Nghệ Sử Dụng

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

## 💻 Yêu Cầu Hệ Thống

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

## 🚀 Cài Đặt

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

### 4. Setup Mobile App (TraffiGo)

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

## 📖 Sử Dụng

### Chạy Thu Thập Dữ Liệu

#### 1️⃣ Thu Thập Dữ Liệu Tĩnh (Static Data)

```bash
cd DATA

cd src

# Thu thập dữ liệu tĩnh (đặc tính không thay đổi của đường)
python src/h.py static
```

#### 2️⃣ Thu Thập Dữ Liệu Động (Dynamic Data)

```bash
# Thu thập dữ liệu động thời gian thực
python src/h.py dynamic
```

#### 3️⃣ Chạy Tự Động (Auto Mode - Mỗi 15 phút)

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

## 📊 Cấu Trúc Thư Mục Chi Tiết

### DATN/ - Backend & ML Model

- **main.py**: Điểm khởi đầu chính, orchestrate các thành phần
- **clustering.py**: Triển khai clustering algorithms (K-Means, DBSCAN, etc)
- **traffic.py**: Mô hình dự báo lưu lượng giao thông chính
- **feature_selection.py**: Lựa chọn đặc trưng quan trọng
- **preprocessing.py**: Làm sạch, chuẩn hóa dữ liệu
- **config.py**: Cấu hình parameters, hyperparameters
- **reporting.py**: Tạo báo cáo kết quả phân tích
- **rule_based.py**: Hệ thống luật dựa trên heuristic
- **io_utils.py**: Các utility cho I/O operations
- **processed/**: Thư mục chứa dữ liệu sau khi xử lý

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

## 🧪 Testing

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

## 📝 Tài Liệu Bổ Sung

- [DATA/README.md](DATA/README.md) - Thông tin về datasets và API
- DATN/config.py - Cấu hình mô hình ML
- TraffiGo/app/ - Android app source code

---

**Last Updated**: 2026-05-10

**Năm Học**: 2025-2026
