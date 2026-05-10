package com.example.traffigo.activities;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Intent;
import android.content.IntentSender;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.location.Address;
import android.location.Geocoder;
import android.os.Bundle;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;

import com.example.traffigo.databinding.ActivityNavigationBinding;
import com.google.android.gms.common.api.ResolvableApiException;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.LocationSettingsRequest;
import com.google.android.gms.location.LocationSettingsResponse;
import com.google.android.gms.location.Priority;
import com.google.android.gms.location.SettingsClient;
import com.google.android.gms.maps.CameraUpdateFactory;
import com.google.android.gms.maps.GoogleMap;
import com.google.android.gms.maps.OnMapReadyCallback;
import com.google.android.gms.maps.SupportMapFragment;
import com.google.android.gms.maps.model.BitmapDescriptorFactory;
import com.google.android.gms.maps.model.LatLng;
import com.google.android.gms.maps.model.LatLngBounds;
import com.google.android.gms.maps.model.Marker;
import com.google.android.gms.maps.model.MarkerOptions;
import com.google.android.gms.maps.model.Polyline;
import com.google.android.gms.maps.model.PolylineOptions;
import com.google.android.gms.tasks.Task;

// --- THÊM IMPORT CỦA PLACES API ---
import com.google.android.libraries.places.api.Places;
import com.google.android.libraries.places.api.model.Place;
import com.google.android.libraries.places.widget.Autocomplete;
import com.google.android.libraries.places.widget.model.AutocompleteActivityMode;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import com.google.android.libraries.places.widget.AutocompleteActivity;
import com.google.android.gms.common.api.Status;
public class NavigationActivity extends AppCompatActivity implements OnMapReadyCallback {

    private static final int REQUEST_CHECK_SETTINGS = 1001;

    private ActivityNavigationBinding binding;
    private GoogleMap mMap;
    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;

    private int currentStep = 1;
    private LatLng originPoint, destPoint, currentSelectedLatLng;
    private Marker startMarker, endMarker;
    private Polyline currentPolyline;

    private ActivityResultLauncher<String[]> locationPermissionLauncher;

    // --- LAUNCHER ĐỂ NHẬN KẾT QUẢ TỪ MÀN HÌNH TÌM KIẾM ---
    private ActivityResultLauncher<Intent> autocompleteLauncher;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityNavigationBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        // KHỞI TẠO PLACES API TRƯỚC KHI XÀI
        initPlacesApi();

        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);

        binding.layoutHeader.tvPageTitle.setText("LỘ TRÌNH");
        binding.layoutHeader.btnShare.setVisibility(View.VISIBLE);
        binding.layoutHeader.btnBack.setOnClickListener(v -> finish());

        binding.layoutHeader.btnShare.setOnClickListener(v -> {
            if (currentSelectedLatLng != null) {
                shareLocation(currentSelectedLatLng, binding.tvAddress.getText().toString());
            } else {
                Toast.makeText(this, "Vui lòng chọn vị trí trên bản đồ để chia sẻ!", Toast.LENGTH_SHORT).show();
            }
        });

        SupportMapFragment mapFragment = (SupportMapFragment) getSupportFragmentManager()
                .findFragmentById(binding.map.getId());
        if (mapFragment != null) mapFragment.getMapAsync(this);

        setupPermissionLauncher();
        setupAutocompleteLauncher(); // Cài đặt Launcher cho thanh tìm kiếm
        setupListeners();
    }

    private void initPlacesApi() {
        String apiKey = getApiKeyFromManifest();
        if (!Places.isInitialized() && apiKey != null && !apiKey.isEmpty()) {
            Places.initialize(getApplicationContext(), apiKey);
        }
    }

    private String getApiKeyFromManifest() {
        try {
            android.content.pm.ApplicationInfo ai = getPackageManager().getApplicationInfo(getPackageName(), android.content.pm.PackageManager.GET_META_DATA);
            Bundle bundle = ai.metaData;
            return bundle.getString("com.google.android.geo.API_KEY");
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }

    private void setupAutocompleteLauncher() {
        autocompleteLauncher = registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(),
                result -> {
                    if (result.getResultCode() == RESULT_OK && result.getData() != null) {
                        // Lấy thông tin địa điểm người dùng vừa chọn
                        Place place = Autocomplete.getPlaceFromIntent(result.getData());
                        LatLng latLng = place.getLatLng();
                        if (latLng != null) {
                            moveToLatLng(latLng); // Tự động di chuyển bản đồ tới đó
                            binding.tvAddress.setText(place.getName() != null ? place.getName() : place.getAddress());
                        }
                    }
                    // CHỖ NÀY ĐÃ SỬA THÀNH AutocompleteActivity.RESULT_ERROR
                    else if (result.getResultCode() == AutocompleteActivity.RESULT_ERROR) {
                        if (result.getData() != null) {
                            // Lấy lỗi chi tiết ra xem Google nó chửi gì
                            Status status = Autocomplete.getStatusFromIntent(result.getData());
                            Log.e("PLACES_API_ERROR", "Lỗi: " + status.getStatusMessage());
                            Toast.makeText(this, "Lỗi tìm kiếm: " + status.getStatusMessage(), Toast.LENGTH_SHORT).show();
                        }
                    }
                }
        );
    }

    private void setupListeners() {
        binding.btnMainAction.setOnClickListener(v -> handleFlow());

        binding.btnCurrentLoc.setOnClickListener(v -> {
            if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                locationPermissionLauncher.launch(new String[]{Manifest.permission.ACCESS_FINE_LOCATION});
            } else {
                checkGPSSettingsAndGetLocation();
            }
        });

        binding.btnHomeShortcut.setOnClickListener(v -> moveToLatLng(new LatLng(10.7626, 106.6823)));
        binding.btnWorkShortcut.setOnClickListener(v -> moveToLatLng(new LatLng(10.7767, 106.6656)));

        // --- SỰ KIỆN MỞ MÀN HÌNH TÌM KIẾM KHI BẤM VÀO ĐỊA CHỈ ---
        binding.tvAddress.setOnClickListener(v -> openSearchPlaceUI());
    }

    // Hàm gọi giao diện tìm kiếm y hệt Google Maps
    private void openSearchPlaceUI() {
        if (!Places.isInitialized()) {
            Toast.makeText(this, "Places API chưa khởi tạo, check lại Key!", Toast.LENGTH_SHORT).show();
            return;
        }

        // Quy định những thông tin muốn lấy về (Tên, Tọa độ, Địa chỉ chi tiết)
        List<Place.Field> fields = Arrays.asList(Place.Field.ID, Place.Field.NAME, Place.Field.LAT_LNG, Place.Field.ADDRESS);

        // Mở giao diện Autocomplete (dạng OVERLAY mờ đè lên màn hình)
        Intent intent = new Autocomplete.IntentBuilder(AutocompleteActivityMode.OVERLAY, fields)
                .setCountry("VN") // Giới hạn chỉ tìm kiếm ở Việt Nam cho chuẩn
                .build(this);
        autocompleteLauncher.launch(intent);
    }

    // Các hàm setup Permission và Location giữ nguyên không đổi...
    private void setupPermissionLauncher() {
        locationPermissionLauncher = registerForActivityResult(
                new ActivityResultContracts.RequestMultiplePermissions(),
                result -> {
                    if (Boolean.TRUE.equals(result.getOrDefault(Manifest.permission.ACCESS_FINE_LOCATION, false))) {
                        enableMyLocation();
                    }
                }
        );
    }

    private void checkGPSSettingsAndGetLocation() {
        LocationRequest locationRequest = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 5000).build();
        LocationSettingsRequest.Builder builder = new LocationSettingsRequest.Builder().addLocationRequest(locationRequest);
        SettingsClient client = LocationServices.getSettingsClient(this);
        Task<LocationSettingsResponse> task = client.checkLocationSettings(builder.build());

        task.addOnSuccessListener(this, locationSettingsResponse -> startLocationUpdates());
        task.addOnFailureListener(this, e -> {
            if (e instanceof ResolvableApiException) {
                try {
                    ((ResolvableApiException) e).startResolutionForResult(NavigationActivity.this, REQUEST_CHECK_SETTINGS);
                } catch (IntentSender.SendIntentException ignored) {}
            }
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_CHECK_SETTINGS) {
            if (resultCode == RESULT_OK) {
                startLocationUpdates();
            } else {
                Toast.makeText(this, "Không thể xác định vị trí nếu GPS tắt!", Toast.LENGTH_SHORT).show();
            }
        }
    }

    @SuppressLint("MissingPermission")
    private void startLocationUpdates() {
        Toast.makeText(this, "Đang xác định vị trí...", Toast.LENGTH_SHORT).show();
        LocationRequest locationRequest = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 1000)
                .setWaitForAccurateLocation(true)
                .setMaxUpdates(1)
                .build();

        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(@NonNull LocationResult locationResult) {
                if (locationResult.getLastLocation() != null) {
                    moveToLatLng(new LatLng(locationResult.getLastLocation().getLatitude(), locationResult.getLastLocation().getLongitude()));
                    fusedLocationClient.removeLocationUpdates(locationCallback);
                }
            }
        };
        fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback, Looper.getMainLooper());
    }

    @Override
    public void onMapReady(@NonNull GoogleMap googleMap) {
        mMap = googleMap;
        mMap.getUiSettings().setMapToolbarEnabled(false);
        mMap.setOnMapClickListener(this::updateSelection);

        LatLng defaultLoc = new LatLng(10.7767, 106.6656);
        mMap.moveCamera(CameraUpdateFactory.newLatLngZoom(defaultLoc, 15f));
        enableMyLocation();
    }

    private void updateSelection(LatLng latLng) {
        currentSelectedLatLng = latLng;
        if (currentStep == 1) {
            originPoint = latLng;
            if (startMarker != null) startMarker.remove();
            startMarker = mMap.addMarker(new MarkerOptions().position(latLng).title("Điểm xuất phát")
                    .icon(BitmapDescriptorFactory.defaultMarker(BitmapDescriptorFactory.HUE_AZURE)));
        } else {
            destPoint = latLng;
            if (endMarker != null) endMarker.remove();
            endMarker = mMap.addMarker(new MarkerOptions().position(latLng).title("Điểm đến")
                    .icon(BitmapDescriptorFactory.defaultMarker(BitmapDescriptorFactory.HUE_ROSE)));
        }
        updateAddressText(latLng);
    }

    private void updateAddressText(LatLng latLng) {
        new Thread(() -> {
            try {
                Geocoder geocoder = new Geocoder(this, Locale.getDefault());
                List<Address> addresses = geocoder.getFromLocation(latLng.latitude, latLng.longitude, 1);
                if (addresses != null && !addresses.isEmpty()) {
                    String addr = addresses.get(0).getAddressLine(0);
                    runOnUiThread(() -> binding.tvAddress.setText(addr));
                }
            } catch (Exception e) {
                runOnUiThread(() -> binding.tvAddress.setText(latLng.latitude + ", " + latLng.longitude));
            }
        }).start();
    }

    private void handleFlow() {
        if (currentStep == 1) {
            if (originPoint == null) return;
            currentStep = 2;
            binding.tvStepTitle.setText("Bạn muốn đi đâu?");
            binding.btnMainAction.setText("Xác nhận điểm đến");
            binding.btnMainAction.setBackgroundTintList(getColorStateList(android.R.color.holo_orange_dark));
        } else {
            if (destPoint == null) return;
            fetchAndDrawRoute(originPoint, destPoint);
        }
    }

    private void shareLocation(LatLng latLng, String address) {
        String googleMapsLink = "https://www.google.com/maps/search/?api=1&query=" + latLng.latitude + "," + latLng.longitude;
        String shareBody = "📍 Vị trí từ TraffiGo:\n" + address + "\n\n🔗 Xem trên bản đồ:\n" + googleMapsLink;

        Intent intent = new Intent(Intent.ACTION_SEND);
        intent.setType("text/plain");
        intent.putExtra(Intent.EXTRA_TEXT, shareBody);
        startActivity(Intent.createChooser(intent, "Chia sẻ vị trí qua..."));
    }

    private void moveToLatLng(LatLng latLng) {
        mMap.animateCamera(CameraUpdateFactory.newLatLngZoom(latLng, 16f));
        updateSelection(latLng);
    }

    @SuppressLint("MissingPermission")
    private void enableMyLocation() {
        if (mMap != null && ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            mMap.setMyLocationEnabled(true);
            mMap.getUiSettings().setMyLocationButtonEnabled(false);
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (fusedLocationClient != null && locationCallback != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
        }
    }

    // ================= PHẦN CODE TÌM VÀ VẼ ĐƯỜNG ĐI =================
    private void fetchAndDrawRoute(LatLng origin, LatLng dest) {
        String apiKey = getApiKeyFromManifest();
        String url = "https://maps.googleapis.com/maps/api/directions/json?origin=" + origin.latitude + "," + origin.longitude + "&destination=" + dest.latitude + "," + dest.longitude + "&mode=driving&key=" + apiKey;

        Toast.makeText(this, "Đang tìm đường đi...", Toast.LENGTH_SHORT).show();

        new Thread(() -> {
            try {
                URL urlObj = new URL(url);
                HttpURLConnection conn = (HttpURLConnection) urlObj.openConnection();
                conn.setRequestMethod("GET");

                InputStream is = conn.getInputStream();
                BufferedReader reader = new BufferedReader(new InputStreamReader(is));
                StringBuilder response = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) response.append(line);
                reader.close();

                JSONObject jsonObject = new JSONObject(response.toString());
                JSONArray routes = jsonObject.getJSONArray("routes");

                String status = jsonObject.optString("status", "UNKNOWN");
                String errorMessage = jsonObject.optString("error_message", "Không có chi tiết lỗi");

                if (routes.length() > 0) {
                    JSONObject route = routes.getJSONObject(0);
                    String encodedString = route.getJSONObject("overview_polyline").getString("points");
                    List<LatLng> path = decodePoly(encodedString);

                    runOnUiThread(() -> {
                        if (currentPolyline != null) currentPolyline.remove();
                        PolylineOptions polylineOptions = new PolylineOptions().addAll(path).width(12f).color(Color.parseColor("#4285F4")).geodesic(true);
                        currentPolyline = mMap.addPolyline(polylineOptions);

                        LatLngBounds.Builder boundsBuilder = new LatLngBounds.Builder();
                        for (LatLng latLngPoint : path) boundsBuilder.include(latLngPoint);
                        mMap.animateCamera(CameraUpdateFactory.newLatLngBounds(boundsBuilder.build(), 150));
                    });
                } else {
                    runOnUiThread(() -> {
                        String msg = "Lỗi: " + status + "\nChi tiết: " + errorMessage;
                        Toast.makeText(NavigationActivity.this, msg, Toast.LENGTH_LONG).show();
                        Log.e("GOOGLE_MAP_ERROR", msg); // Bắn ra cả Logcat cho chắc ăn
                    });
                }
            } catch (Exception e) {
                e.printStackTrace();
                runOnUiThread(() -> Toast.makeText(NavigationActivity.this, "Lỗi kết nối khi tải đường đi", Toast.LENGTH_SHORT).show());
            }
        }).start();
    }

    private List<LatLng> decodePoly(String encoded) {
        List<LatLng> poly = new ArrayList<>();
        int index = 0, len = encoded.length(), lat = 0, lng = 0;
        while (index < len) {
            int b, shift = 0, result = 0;
            do {
                b = encoded.charAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            lat += ((result & 1) != 0 ? ~(result >> 1) : (result >> 1));
            shift = 0; result = 0;
            do {
                b = encoded.charAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            lng += ((result & 1) != 0 ? ~(result >> 1) : (result >> 1));
            poly.add(new LatLng((lat / 1E5), (lng / 1E5)));
        }
        return poly;
    }
}