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
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;

import com.example.traffigo.R;
import com.example.traffigo.models.TrafficSegment;
import com.google.android.gms.common.api.ResolvableApiException;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.LocationSettingsRequest;
import com.google.android.gms.location.LocationSettingsResponse;
import com.google.android.gms.location.SettingsClient;
import com.google.android.gms.maps.CameraUpdateFactory;
import com.google.android.gms.maps.GoogleMap;
import com.google.android.gms.maps.OnMapReadyCallback;
import com.google.android.gms.maps.SupportMapFragment;
import com.google.android.gms.maps.model.LatLng;
import com.google.android.gms.maps.model.LatLngBounds;
import com.google.android.gms.maps.model.MarkerOptions;
import com.google.android.gms.maps.model.Polyline;
import com.google.android.gms.maps.model.PolylineOptions;
import com.google.android.gms.maps.model.RoundCap;
import com.google.android.gms.tasks.Task;
import com.google.android.material.bottomsheet.BottomSheetDialog;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class TrafficMapActivity extends AppCompatActivity implements OnMapReadyCallback {

    private static final int REQUEST_CHECK_SETTINGS = 321;

    private GoogleMap mMap;
    private FusedLocationProviderClient fusedLocationClient;
    private final List<TrafficSegment> allSegments = new ArrayList<>();
    private final List<Polyline> displayedPolylines = new ArrayList<>();
    private final ExecutorService executorService = Executors.newFixedThreadPool(4);
    private boolean isDataLoaded = false;
    private float currentZoom = 15f;

    private ActivityResultLauncher<String[]> locationPermissionLauncher;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_traffic_map);

        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);

        SupportMapFragment mapFragment = (SupportMapFragment) getSupportFragmentManager()
                .findFragmentById(R.id.map);
        if (mapFragment != null) mapFragment.getMapAsync(this);

        // Đăng ký quyền
        locationPermissionLauncher = registerForActivityResult(
                new ActivityResultContracts.RequestMultiplePermissions(),
                result -> {
                    if (Boolean.TRUE.equals(result.getOrDefault(Manifest.permission.ACCESS_FINE_LOCATION, false))) {
                        enableMyLocationLayer();
                        checkAndEnableGPS();
                    }
                }
        );

        initSearch();
        preloadTrafficData();

        // Nút Vị trí hiện tại (Nếu trong XML Huy có id này, nếu không tui dựa theo logic các màn cũ)
        View btnLoc = findViewById(R.id.btnCurrentLoc);
        if (btnLoc != null) {
            btnLoc.setOnClickListener(v -> handleCurrentLocationClick());
        }
        TextView tvTitle = findViewById(R.id.tvPageTitle);
        if (tvTitle != null) {
            tvTitle.setText("TÌNH TRẠNG GIAO THÔNG"); // Đổi tên tại đây
        }
        findViewById(R.id.btnBack).setOnClickListener(v -> finish());
    }

    private void initSearch() {
        EditText edtSearch = findViewById(R.id.edtSearch);
        edtSearch.setOnEditorActionListener((v, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_SEARCH) {
                searchLocation(edtSearch.getText().toString());
                return true;
            }
            return false;
        });
    }

    @Override
    public void onMapReady(@NonNull GoogleMap googleMap) {
        mMap = googleMap;
        mMap.getUiSettings().setMapToolbarEnabled(false);
        mMap.getUiSettings().setZoomControlsEnabled(false);

        // Mặc định ban đầu ở Gò Vấp (như Huy code)
        LatLng defaultPos = new LatLng(10.8398, 106.6791);
        mMap.moveCamera(CameraUpdateFactory.newLatLngZoom(defaultPos, 15f));

        mMap.setOnPolylineClickListener(polyline -> {
            TrafficSegment segment = (TrafficSegment) polyline.getTag();
            if (segment != null) {
                String status = "Thông thoáng";
                if (segment.congestionIndex < 0.7) status = "Kẹt xe nặng";
                else if (segment.congestionIndex < 0.85) status = "Mật độ cao";
                showTrafficBottomSheet(segment.name, segment.speed, status);
            }
        });

        mMap.setOnCameraMoveListener(() -> {
            float newZoom = mMap.getCameraPosition().zoom;
            if (Math.abs(newZoom - currentZoom) > 0.5) {
                currentZoom = newZoom;
                renderVisibleSegments();
            }
        });

        mMap.setOnCameraIdleListener(this::renderVisibleSegments);

        // Kiểm tra quyền khi vào map
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            mMap.setMyLocationEnabled(true);
        }
    }

    private void handleCurrentLocationClick() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            locationPermissionLauncher.launch(new String[]{Manifest.permission.ACCESS_FINE_LOCATION});
        } else {
            checkAndEnableGPS();
        }
    }

    private void checkAndEnableGPS() {
        LocationRequest locationRequest = LocationRequest.create().setPriority(LocationRequest.PRIORITY_HIGH_ACCURACY);
        LocationSettingsRequest.Builder builder = new LocationSettingsRequest.Builder().addLocationRequest(locationRequest);
        SettingsClient client = LocationServices.getSettingsClient(this);
        Task<LocationSettingsResponse> task = client.checkLocationSettings(builder.build());

        task.addOnSuccessListener(this, response -> getCurrentLocation());
        task.addOnFailureListener(this, e -> {
            if (e instanceof ResolvableApiException) {
                try {
                    ResolvableApiException resolvable = (ResolvableApiException) e;
                    resolvable.startResolutionForResult(TrafficMapActivity.this, REQUEST_CHECK_SETTINGS);
                } catch (IntentSender.SendIntentException sendEx) { }
            }
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_CHECK_SETTINGS && resultCode == RESULT_OK) {
            getCurrentLocation();
        }
    }

    @SuppressLint("MissingPermission")
    private void getCurrentLocation() {
        fusedLocationClient.getLastLocation().addOnSuccessListener(location -> {
            if (location != null) {
                mMap.animateCamera(CameraUpdateFactory.newLatLngZoom(new LatLng(location.getLatitude(), location.getLongitude()), 17f));
            } else {
                requestNewLocationUpdate();
            }
        });
    }

    @SuppressLint("MissingPermission")
    private void requestNewLocationUpdate() {
        LocationRequest locationRequest = LocationRequest.create()
                .setPriority(LocationRequest.PRIORITY_HIGH_ACCURACY)
                .setNumUpdates(1);
        fusedLocationClient.requestLocationUpdates(locationRequest, new LocationCallback() {
            @Override
            public void onLocationResult(@NonNull LocationResult locationResult) {
                if (locationResult.getLastLocation() != null) {
                    LatLng current = new LatLng(locationResult.getLastLocation().getLatitude(), locationResult.getLastLocation().getLongitude());
                    mMap.animateCamera(CameraUpdateFactory.newLatLngZoom(current, 17f));
                }
            }
        }, Looper.getMainLooper());
    }

    @SuppressLint("MissingPermission")
    private void enableMyLocationLayer() {
        if (mMap != null) mMap.setMyLocationEnabled(true);
    }

    private void searchLocation(String locationName) {
        Geocoder geocoder = new Geocoder(this, Locale.getDefault());
        try {
            List<Address> list = geocoder.getFromLocationName(locationName, 1);
            if (!list.isEmpty()) {
                Address addr = list.get(0);
                LatLng latLng = new LatLng(addr.getLatitude(), addr.getLongitude());
                mMap.animateCamera(CameraUpdateFactory.newLatLngZoom(latLng, 17f));
                mMap.addMarker(new MarkerOptions().position(latLng).title(locationName));
            } else {
                Toast.makeText(this, "Không tìm thấy địa điểm!", Toast.LENGTH_SHORT).show();
            }
        } catch (Exception e) { e.printStackTrace(); }
    }

    // --- Giữ nguyên các hàm preload và render cũ của Huy ---
    private void preloadTrafficData() {
        executorService.execute(() -> {
            try {
                Map<String, RealData> realMap = new HashMap<>();
                BufferedReader tr = new BufferedReader(new InputStreamReader(getAssets().open("traffic_data.csv")));
                tr.readLine();
                String tLine;
                while ((tLine = tr.readLine()) != null) {
                    String[] t = tLine.split(",");
                    if (t.length >= 30) {
                        realMap.put(t[1], new RealData(Double.parseDouble(t[24]), Double.parseDouble(t[28])));
                    }
                }
                tr.close();

                BufferedReader gr = new BufferedReader(new InputStreamReader(getAssets().open("geometry.csv")));
                gr.readLine();
                String gLine;
                while ((gLine = gr.readLine()) != null) {
                    String[] g = gLine.split(",(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)");
                    if (g.length < 6) continue;
                    String name = g[0];
                    String fullGeom = g[5].replace("\"", "");
                    double speed = 35.0, cong = 1.0;
                    if (realMap.containsKey(name)) {
                        speed = realMap.get(name).s;
                        cong = realMap.get(name).c;
                    }
                    allSegments.add(new TrafficSegment(name,
                            Double.parseDouble(g[2]), Double.parseDouble(g[1]),
                            Double.parseDouble(g[4]), Double.parseDouble(g[3]),
                            speed, cong, fullGeom));
                }
                gr.close();
                isDataLoaded = true;
                runOnUiThread(this::renderVisibleSegments);
            } catch (Exception e) { e.printStackTrace(); }
        });
    }

    private void renderVisibleSegments() {
        if (!isDataLoaded || mMap == null || executorService.isShutdown()) return;
        final LatLngBounds bounds = mMap.getProjection().getVisibleRegion().latLngBounds;
        final float dynamicWidth = Math.max(2f, (currentZoom - 10f) * 2.5f);

        executorService.execute(() -> {
            List<PolylineOptions> newOptions = new ArrayList<>();
            List<TrafficSegment> newSegments = new ArrayList<>();
            for (TrafficSegment segment : allSegments) {
                if (bounds.contains(segment.start) || bounds.contains(segment.end)) {
                    PolylineOptions polyOpts = new PolylineOptions()
                            .width(dynamicWidth).clickable(true)
                            .startCap(new RoundCap()).endCap(new RoundCap())
                            .addAll(segment.getGeometryList());
                    int color = Color.parseColor("#4CAF50");
                    if (segment.congestionIndex < 0.7) color = Color.RED;
                    else if (segment.congestionIndex < 0.85) color = Color.parseColor("#FF9800");
                    polyOpts.color(color);
                    newOptions.add(polyOpts);
                    newSegments.add(segment);
                }
            }
            runOnUiThread(() -> {
                if (mMap == null) return;
                for (Polyline p : displayedPolylines) p.remove();
                displayedPolylines.clear();
                for (int i = 0; i < newOptions.size(); i++) {
                    Polyline polyline = mMap.addPolyline(newOptions.get(i));
                    polyline.setTag(newSegments.get(i));
                    displayedPolylines.add(polyline);
                }
            });
        });
    }

    private void showTrafficBottomSheet(String name, double speed, String status) {
        BottomSheetDialog dialog = new BottomSheetDialog(this);
        View view = getLayoutInflater().inflate(R.layout.bottom_sheet_traffic, null);
        ((TextView) view.findViewById(R.id.tvStreetName)).setText(name);
        ((TextView) view.findViewById(R.id.tvSpeed)).setText(String.format("Vận tốc: %.1f km/h", speed));
        TextView tvStatus = view.findViewById(R.id.tvStatus);
        tvStatus.setText("Trạng thái: " + status);
        int color = Color.parseColor("#4CAF50");
        if (status.equals("Kẹt xe nặng")) color = Color.RED;
        else if (status.equals("Mật độ cao")) color = Color.parseColor("#FF9800");
        tvStatus.setTextColor(color);
        dialog.setContentView(view);
        dialog.show();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        executorService.shutdownNow();
    }

    private static class RealData {
        double s, c;
        RealData(double s, double c) { this.s = s; this.c = c; }
    }
}