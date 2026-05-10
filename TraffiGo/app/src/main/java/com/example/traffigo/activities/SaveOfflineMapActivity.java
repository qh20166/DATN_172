package com.example.traffigo.activities;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Intent;
import android.content.IntentSender;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.os.Looper;
import android.view.ViewGroup;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;

import com.example.traffigo.R;
import com.google.android.gms.common.api.ResolvableApiException;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.LocationSettingsRequest;
import com.google.android.gms.location.Priority;
import com.google.android.gms.maps.CameraUpdateFactory;
import com.google.android.gms.maps.GoogleMap;
import com.google.android.gms.maps.OnMapReadyCallback;
import com.google.android.gms.maps.SupportMapFragment;
import com.google.android.gms.maps.model.LatLng;

import java.io.FileOutputStream;

public class SaveOfflineMapActivity extends AppCompatActivity implements OnMapReadyCallback {

    private static final int REQUEST_CHECK_SETTINGS = 1001;
    private static final int LOCATION_PERMISSION_REQUEST_CODE = 1002;
    private static final String PREFS_NAME = "TraffiGoPrefs";

    private GoogleMap mMap;
    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_save_offline_map);

        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);

        SupportMapFragment mapFragment = (SupportMapFragment) getSupportFragmentManager()
                .findFragmentById(R.id.mapSave);
        if (mapFragment != null) mapFragment.getMapAsync(this);

        // Nút Back
        findViewById(R.id.btnBackSave).setOnClickListener(v -> finish());

        // Nút Lưu vùng bản đồ
        findViewById(R.id.btnConfirmSave).setOnClickListener(v -> showNamingDialog());

        // Nút Vị trí hiện tại (Có chờ GPS)
        findViewById(R.id.btnMyLocation).setOnClickListener(v -> checkPermissionAndGPS());
    }

    @Override
    public void onMapReady(@NonNull GoogleMap googleMap) {
        mMap = googleMap;
        mMap.getUiSettings().setMyLocationButtonEnabled(false);

        // --- TÍNH NĂNG 3: Mở map tại vị trí lưu gần nhất ---
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        float lastLat = prefs.getFloat("last_lat", 10.7767f); // Mặc định HCM
        float lastLng = prefs.getFloat("last_lng", 106.6656f);
        mMap.moveCamera(CameraUpdateFactory.newLatLngZoom(new LatLng(lastLat, lastLng), 15f));

        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            mMap.setMyLocationEnabled(true);
        }
    }

    // --- HIỆN BẢNG NHẬP TÊN ---
    private void showNamingDialog() {
        if (mMap == null) return;

        // 1. Khởi tạo Dialog Component
        android.app.Dialog dialog = new android.app.Dialog(this);
        dialog.setContentView(R.layout.dialog_save_map);

        // 2. Làm nền trong suốt để thấy bo góc của CardView
        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(android.graphics.Color.TRANSPARENT));
            dialog.getWindow().setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        }

        // 3. Ánh xạ View từ Component Dialog
        com.google.android.material.textfield.TextInputEditText edtMapName = dialog.findViewById(R.id.edtMapName);
        com.google.android.material.button.MaterialButton btnSave = dialog.findViewById(R.id.btnSave);
        com.google.android.material.button.MaterialButton btnCancel = dialog.findViewById(R.id.btnCancel);

        // 4. Xử lý nút Hủy
        btnCancel.setOnClickListener(v -> dialog.dismiss());

        // 5. Xử lý nút Lưu
        btnSave.setOnClickListener(v -> {
            String name = edtMapName.getText().toString().trim();
            if (!name.isEmpty()) {
                dialog.dismiss(); // Đóng bảng
                saveMapWithSnapshot(name); // Gọi hàm chụp ảnh bản đồ
            } else {
                edtMapName.setError("Ông chưa đặt tên mà!");
            }
        });

        dialog.show();
    }

    private void saveMapWithSnapshot(String mapName) {
        Toast.makeText(this, "Đang khởi tạo tệp...", Toast.LENGTH_SHORT).show();

        mMap.snapshot(bitmap -> {
            try {
                // 1. Lưu vị trí camera hiện tại làm "vị trí gần nhất" cho lần sau
                LatLng center = mMap.getCameraPosition().target;
                getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit()
                        .putFloat("last_lat", (float) center.latitude)
                        .putFloat("last_lng", (float) center.longitude)
                        .apply();

                // 2. Lưu file ảnh
                String fileName = "OFFLINE_" + mapName + ".png";
                FileOutputStream out = openFileOutput(fileName, MODE_PRIVATE);
                bitmap.compress(Bitmap.CompressFormat.PNG, 90, out);
                out.close();

                Toast.makeText(this, "Đã lưu bản đồ thành công!", Toast.LENGTH_SHORT).show();
                finish();
            } catch (Exception e) {
                e.printStackTrace();
                Toast.makeText(this, "Lỗi lưu tệp!", Toast.LENGTH_SHORT).show();
            }
        });
    }

    // --- LOGIC GPS & VỊ TRÍ HIỆN TẠI ---
    private void checkPermissionAndGPS() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.ACCESS_FINE_LOCATION}, LOCATION_PERMISSION_REQUEST_CODE);
        } else {
            requestEnableGPS();
        }
    }

    private void requestEnableGPS() {
        LocationRequest locationRequest = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 5000).build();
        LocationSettingsRequest.Builder builder = new LocationSettingsRequest.Builder().addLocationRequest(locationRequest);

        LocationServices.getSettingsClient(this).checkLocationSettings(builder.build())
                .addOnSuccessListener(this, resp -> startLocationUpdates())
                .addOnFailureListener(this, e -> {
                    if (e instanceof ResolvableApiException) {
                        try {
                            ((ResolvableApiException) e).startResolutionForResult(this, REQUEST_CHECK_SETTINGS);
                        } catch (IntentSender.SendIntentException ignored) {}
                    }
                });
    }

    @SuppressLint("MissingPermission")
    private void startLocationUpdates() {
        Toast.makeText(this, "Đang đợi tín hiệu vệ tinh...", Toast.LENGTH_SHORT).show();
        LocationRequest req = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 1000)
                .setWaitForAccurateLocation(true)
                .setMaxUpdates(1)
                .build();

        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(@NonNull LocationResult res) {
                if (res.getLastLocation() != null) {
                    LatLng loc = new LatLng(res.getLastLocation().getLatitude(), res.getLastLocation().getLongitude());
                    mMap.animateCamera(CameraUpdateFactory.newLatLngZoom(loc, 16f));
                    fusedLocationClient.removeLocationUpdates(this);
                }
            }
        };
        fusedLocationClient.requestLocationUpdates(req, locationCallback, Looper.getMainLooper());
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_CHECK_SETTINGS && resultCode == RESULT_OK) {
            startLocationUpdates();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (locationCallback != null) fusedLocationClient.removeLocationUpdates(locationCallback);
    }
}