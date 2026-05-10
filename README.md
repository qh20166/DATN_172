# DATN_172 - Đồ Án Tốt Nghiệp 2024

**TraffiGo** - Hệ thống phân tích và dự báo lưu lượng giao thông sử dụng Machine Learning

## 📋 Mục Lục
- [Giới Thiệu](#giới-thiệu)
- [Cấu Trúc Dự Án](#cấu-trúc-dự-án)
- [Công Nghệ Sử Dụng](#công-nghệ-sử-dụng)
- [Yêu Cầu Hệ Thống](#yêu-cầu-hệ-thống)
- [Cài Đặt](#cài-đặt)
- [Sử Dụng](#sử-dụng)
- [Cấu Trúc Thư Mục Chi Tiết](#cấu-trúc-thư-mục-chi-tiết)
- [Đóng Góp](#đóng-góp)
- [Liên Hệ](#liên-hệ)

## 🎯 Giới Thiệu

**DATN_172** là một dự án toàn diện về **dự báo lưu lượng giao thông** bao gồm:

- 🐍 **Backend/ML Model**: Python - Xử lý dữ liệu và Machine Learning
- 📊 **Data Processing**: Tiền xử lý, làm sạch và phân tích dữ liệu
- 📱 **Mobile App**: Android Studio (Java) - Ứng dụng di động cho người dùng cuối

### Kiến Trúc Hệ Thống

| Thành Phần | Công Nghệ | Mục Đích |
|-----------|-----------|---------|
| **Backend ML** | Python (DATN/) | Xây dựng, huấn luyện, và triển khai mô hình ML |
| **Data Processing** | Python (DATA/) | Tiền xử lý dữ liệu, làm sạch, phân tích EDA |
| **Mobile App** | Android Studio/Java (TraffiGo/) | Giao diện di động cho người dùng cuối |

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

## 🛠️ Công Nghệ Sử Dụng

### Backend & Machine Learning
- **Python 3.8+**
- **NumPy, Pandas** - Xử lý dữ liệu số
- **Scikit-learn** - Machine Learning algorithms
- **Matplotlib, Seaborn** - Trực quan hóa dữ liệu

### Mobile Application
- **Java** - Ngôn ngữ lập trình chính
- **Android SDK** - Framework phát triển
- **Gradle** - Build automation
- **Android Studio** - IDE chính thức

## 💻 Yêu Cầu Hệ Thống

### Backend & Data Processing
- Python 3.8 trở lên
- pip (Python Package Manager)
- Virtual Environment (venv)

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

## 📖 Sử Dụng

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

### DATA/ - Data Management
- **data/**: Thư mục chứa raw datasets (CSV, Excel, etc)
- **src/**: Code xử lý, transform dữ liệu
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

## 📝 Tài Liệu Bổ Sung

- [DATA/README.md](DATA/README.md) - Thông tin về datasets
- DATN/config.py - Cấu hình mô hình ML
- TraffiGo/app/ - Android app source code

## 🤝 Đóng Góp

Nếu bạn muốn đóng góp:

1. Fork repository
2. Tạo branch cho feature (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

Dự án này được cấp phép dưới MIT License - xem file [LICENSE](LICENSE) để biết chi tiết.

## 📞 Liên Hệ

- **Tác Giả**: qh20166
- **GitHub**: [@qh20166](https://github.com/qh20166)
- **Email**: [Your Email]
- **Repository**: [qh20166/DATN_172](https://github.com/qh20166/DATN_172)

---

## 🗓️ Lộ Trình Phát Triển

- [x] Khởi tạo repository
- [x] Chuẩn bị cấu trúc thư mục cơ bản
- [ ] Hoàn thiện data processing pipeline
- [ ] Huấn luyện và optimize ML models
- [ ] Phát triển hoàn chỉnh Mobile App
- [ ] Integration testing toàn hệ thống
- [ ] Deployment & Documentation
- [ ] Performance optimization

---

**Last Updated**: 2026-05-10
