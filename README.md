# DATN_172 - Đồ Án Tốt Nghiệp 2024

Đây là dự án đồ án tốt nghiệp (DATN) bao gồm các thành phần: Backend API, Machine Learning Model, và ứng dụng Mobile.

## 📋 Mục Lục
- [Giới Thiệu](#giới-thiệu)
- [Cấu Trúc Dự Án](#cấu-trúc-dự-án)
- [Công Nghệ Sử Dụng](#công-nghệ-sử-dụng)
- [Yêu Cầu Hệ Thống](#yêu-cầu-hệ-thống)
- [Cài Đặt](#cài-đặt)
- [Sử Dụng](#sử-dụng)
- [Cấu Trúc Thư Mục](#cấu-trúc-thư-mục)
- [Đóng Góp](#đóng-góp)
- [Liên Hệ](#liên-hệ)

## 🎯 Giới Thiệu

**DATN_172** là một dự án toàn diện kết hợp:
- 🐍 **Backend**: Xây dựng API sử dụng Python
- 🤖 **Machine Learning**: Mô hình học máy để xử lý dữ liệu
- 📱 **Mobile App**: Ứng dụng di động (Android/iOS) để tương tác với hệ thống

[Thêm mô tả chi tiết về mục đích dự án của bạn ở đây]

## 📁 Cấu Trúc Dự Án

```
DATN_172/
├── src/
│   ├── data/              # 📊 Xử lý và quản lý dữ liệu
│   │   ├── datasets/      # Dataset gốc và xử lý
│   │   ├── preprocessing/ # Tiền xử lý dữ liệu
│   │   └── utils/         # Các utility cho dữ liệu
│   │
│   ├── model/             # 🤖 Machine Learning Models
│   │   ├── training/      # Script huấn luyện model
│   │   ├── evaluation/    # Đánh giá model
│   │   ├── inference/     # Dự đoán/suy diễn
│   │   └── saved_models/  # Các model đã huấn luyện
│   │
│   └── mobile/            # 📱 Ứng dụng Mobile
│       ├── src/           # Source code
│       ├── assets/        # Hình ảnh, fonts, etc
│       ├── components/    # Reusable components
│       └── screens/       # Các màn hình ứng dụng
│
├── docs/                  # 📚 Tài liệu
├── tests/                 # 🧪 Unit tests
├── requirements.txt       # Python dependencies
├── README.md             # File này
└── .gitignore
```

## 🛠️ Công Nghệ Sử Dụng

### Backend & Data Processing
- **Python 3.8+**
- **NumPy, Pandas** - Xử lý dữ liệu
- **Scikit-learn** - Machine Learning
- **TensorFlow / PyTorch** - Deep Learning (nếu cần)
- **Flask / FastAPI** - Web Framework

### Mobile App
- **Java** (Android Native) hoặc React Native
- **XML** (UI Layout)
- **RESTful API** - Giao tiếp với Backend

### Frontend
- **HTML5** - Cấu trúc
- **CSS3** - Styling
- **JavaScript** - Tương tác

## 💻 Yêu Cầu Hệ Thống

### Backend
- Python 3.8 trở lên
- pip (Python Package Manager)
- Virtual Environment

### Mobile
- Android Studio (nếu phát triển Android)
- JDK 8+
- Gradle

### Chung
- Git
- 2GB RAM tối thiểu
- 1GB dung lượng ổ cứng

## 🚀 Cài Đặt

### 1. Clone Repository
```bash
git clone https://github.com/qh20166/DATN_172.git
cd DATN_172
```

### 2. Setup Backend/Data Processing

```bash
# Tạo virtual environment
python -m venv venv

# Kích hoạt virtual environment
# Trên Windows:
venv\Scripts\activate
# Trên macOS/Linux:
source venv/bin/activate

# Cài đặt dependencies
pip install -r requirements.txt
```

### 3. Setup Mobile App

```bash
cd src/mobile

# Nếu dùng React Native
npm install
# hoặc
yarn install

# Nếu dùng Android Native
# Mở project trong Android Studio
```

### 4. Chuẩn Bị Dữ Liệu

```bash
cd src/data
python preprocessing/prepare_data.py
```

## 📖 Sử Dụng

### Chạy Backend API
```bash
python -m src.api.main
# API sẽ chạy tại http://localhost:5000
```

### Huấn Luyện Model
```bash
python src/model/training/train.py --dataset data/datasets/train.csv
```

### Chạy Ứng Dụng Mobile

**Android:**
```bash
cd src/mobile
gradle assembleDebug
# hoặc từ Android Studio: Build > Build Bundles/APK
```

**React Native:**
```bash
cd src/mobile
npm start
npx react-native run-android
```

## 📊 Cấu Trúc Thư Mục Chi Tiết

### src/data/
- Chứa tất cả các file dữ liệu, dataset
- Các script tiền xử lý và làm sạch dữ liệu
- Utilities để tải và xử lý dữ liệu

### src/model/
- Mã nguồn training, evaluation, inference
- Các model đã huấn luyện (saved weights)
- Configuration cho hyperparameters
- Scripts để test model

### src/mobile/
- Ứng dụng di động hoàn chỉnh
- Giao diện người dùng (UI/UX)
- Kết nối API backend
- Local storage và caching

## 🧪 Testing

```bash
# Chạy unit tests
python -m pytest tests/

# Test API endpoints
python -m pytest tests/test_api.py -v

# Test model accuracy
python src/model/evaluation/evaluate.py
```

## 📝 Tài Liệu

Chi tiết hơn về từng thành phần:
- [Data Processing Guide](docs/DATA_GUIDE.md)
- [Model Training Guide](docs/MODEL_GUIDE.md)
- [Mobile App Guide](docs/MOBILE_GUIDE.md)
- [API Documentation](docs/API_DOCS.md)

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

---

## 🗓️ Lộ Trình Phát Triển

- [x] Khởi tạo repository
- [ ] Chuẩn bị dataset
- [ ] Xây dựng Backend API
- [ ] Huấn luyện ML Model
- [ ] Phát triển Mobile App
- [ ] Integration testing
- [ ] Deployment

---

**Last Updated**: 2026-05-10
