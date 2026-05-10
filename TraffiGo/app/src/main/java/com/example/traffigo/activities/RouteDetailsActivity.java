package com.example.traffigo.activities;

import android.graphics.Color;
import android.os.AsyncTask;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;

import com.example.traffigo.R;
import com.example.traffigo.models.TrafficSegment;
import com.example.traffigo.utils.PathFinder;
import com.google.android.gms.maps.*;
import com.google.android.gms.maps.model.*;

import java.io.*;
import java.util.*;

public class RouteDetailsActivity extends AppCompatActivity implements OnMapReadyCallback {

    private GoogleMap mMap;
    private LatLng origin, destination;
    private ProgressBar progressBar;
    private TextView tvRouteInfo;
    private List<TrafficSegment> allSegments = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_route_details);

        progressBar = findViewById(R.id.progressBar);
        tvRouteInfo = findViewById(R.id.tvRouteInfo);

        // Nhận tọa độ gửi từ màn hình Search/Main
        origin = new LatLng(getIntent().getDoubleExtra("origin_lat", 10.7767),
                getIntent().getDoubleExtra("origin_lon", 106.6656));
        destination = new LatLng(getIntent().getDoubleExtra("dest_lat", 10.8398),
                getIntent().getDoubleExtra("dest_lon", 106.6791));

        SupportMapFragment mapFragment = (SupportMapFragment) getSupportFragmentManager().findFragmentById(R.id.map);
        if (mapFragment != null) mapFragment.getMapAsync(this);

        findViewById(R.id.btnBackDetail).setOnClickListener(v -> finish());
    }

    @Override
    public void onMapReady(@NonNull GoogleMap googleMap) {
        mMap = googleMap;
        mMap.getUiSettings().setRotateGesturesEnabled(true);
        mMap.setTrafficEnabled(true);

        // Chạy tiến trình nạp dữ liệu và tính toán
        new RouteTask().execute();
    }

    private class RouteTask extends AsyncTask<Void, Void, List<LatLng>> {
        @Override
        protected void onPreExecute() {
            progressBar.setVisibility(View.VISIBLE);
            tvRouteInfo.setText("Đang nạp dữ liệu giao thông...");
        }

        @Override
        protected List<LatLng> doInBackground(Void... voids) {
            Map<String, String> geoCache = new HashMap<>();
            allSegments.clear();

            try {
                // 1. Đọc geometry.csv (ID;FullGeometry)
                BufferedReader brGeo = new BufferedReader(new InputStreamReader(getAssets().open("geometry.csv")));
                String line; brGeo.readLine(); // Skip header
                while ((line = brGeo.readLine()) != null) {
                    String[] p = line.split(";");
                    if (p.length >= 2) geoCache.put(p[0], p[1]);
                }
                brGeo.close();

                // 2. Đọc traffic_data.csv và kết hợp
                BufferedReader brTrf = new BufferedReader(new InputStreamReader(getAssets().open("traffic_data.csv")));
                brTrf.readLine(); // Skip header
                while ((line = brTrf.readLine()) != null) {
                    String[] p = line.split(";");
                    String id = p[0];
                    if (geoCache.containsKey(id)) {
                        allSegments.add(new TrafficSegment(id,
                                Double.parseDouble(p[1]), Double.parseDouble(p[2]), // start lat/lon
                                Double.parseDouble(p[3]), Double.parseDouble(p[4]), // end lat/lon
                                Double.parseDouble(p[5]), // speed
                                Double.parseDouble(p[6]), // congestion
                                geoCache.get(id)));        // geometry chi tiết
                    }
                }
                brTrf.close();

                // 3. Thuật toán Dijkstra
                PathFinder finder = new PathFinder();
                finder.buildGraph(allSegments);
                String sNode = finder.findNearestNode(origin, allSegments);
                String eNode = finder.findNearestNode(destination, allSegments);

                return finder.findFastestPath(sNode, eNode);

            } catch (Exception e) {
                Log.e("TraffiGo", "Error: " + e.getMessage());
                return null;
            }
        }

        @Override
        protected void onPostExecute(List<LatLng> path) {
            progressBar.setVisibility(View.GONE);
            if (path != null && !path.isEmpty()) {
                drawResult(path);
                tvRouteInfo.setText("Lộ trình nhanh nhất đã được thiết lập.");
            } else {
                tvRouteInfo.setText("Lỗi: Không tìm thấy đường đi.");
                Toast.makeText(RouteDetailsActivity.this, "Kiểm tra lại dữ liệu CSV!", Toast.LENGTH_SHORT).show();
            }
        }
    }

    private void drawResult(List<LatLng> path) {
        // Marker đầu cuối
        mMap.addMarker(new MarkerOptions().position(path.get(0)).title("Điểm đi")
                .icon(BitmapDescriptorFactory.defaultMarker(BitmapDescriptorFactory.HUE_AZURE)));
        mMap.addMarker(new MarkerOptions().position(path.get(path.size()-1)).title("Điểm đến"));

        // Vẽ đường đi uốn lượn
        mMap.addPolyline(new PolylineOptions().addAll(path).width(14f)
                .color(Color.parseColor("#5142AB")).startCap(new RoundCap()).endCap(new RoundCap()));

        // Zoom Camera
        LatLngBounds.Builder b = new LatLngBounds.Builder();
        for (LatLng p : path) b.include(p);
        mMap.animateCamera(CameraUpdateFactory.newLatLngBounds(b.build(), 200));
    }
}