package com.example.traffigo.activities;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.ImageButton;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.example.traffigo.R;
import com.example.traffigo.adapters.OfflineMapAdapter;
import com.example.traffigo.models.OfflineMap;
import java.io.File;
import java.util.ArrayList;
import java.util.List;

public class OfflineMapsActivity extends AppCompatActivity {

    private RecyclerView rvOfflineMaps;
    private OfflineMapAdapter adapter;
    private List<OfflineMap> offlineMapList;
    private TextView tvEmpty;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_offline_maps);

        // 1. Khởi tạo View
        rvOfflineMaps = findViewById(R.id.rvOfflineMaps);
        tvEmpty = findViewById(R.id.tvEmpty);
        rvOfflineMaps.setLayoutManager(new LinearLayoutManager(this));

        offlineMapList = new ArrayList<>();

        // 2. Thiết lập Header
        setupHeader();
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Tự động load lại danh sách mỗi khi quay lại màn hình này
        loadSavedMaps();
    }

    private void setupHeader() {
        View header = findViewById(R.id.layoutHeader);
        TextView tvTitle = header.findViewById(R.id.tvPageTitle);
        ImageButton btnBack = header.findViewById(R.id.btnBack);
        ImageButton btnAdd = findViewById(R.id.fabAddOfflineMap);

        if (tvTitle != null) tvTitle.setText("Bản đồ ngoại tuyến");

        if (btnBack != null) {
            btnBack.setOnClickListener(v -> finish());
        }

        if (btnAdd != null) {
            btnAdd.setVisibility(View.VISIBLE);
            btnAdd.setImageResource(R.drawable.ic_add); // Icon dấu cộng
            btnAdd.setOnClickListener(v -> {
                // Mở màn hình riêng để chụp bản đồ mới
                startActivity(new Intent(this, SaveOfflineMapActivity.class));
            });
        }
    }

    private void loadSavedMaps() {
        offlineMapList.clear();
        File directory = getFilesDir();
        File[] files = directory.listFiles((dir, name) -> name.startsWith("OFFLINE_"));

        if (files != null && files.length > 0) {
            // --- SẮP XẾP Ở ĐÂY ---
            java.util.Arrays.sort(files, (f1, f2) -> Long.compare(f2.lastModified(), f1.lastModified()));
            // ---------------------

            tvEmpty.setVisibility(View.GONE);
            for (File file : files) {
                String rawName = file.getName();
                String displayName = rawName.substring(rawName.indexOf("_") + 1, rawName.lastIndexOf("."));
                String date = "Lưu ngày: " + new java.util.Date(file.lastModified()).toLocaleString();
                offlineMapList.add(new OfflineMap(displayName, file.getAbsolutePath(), date));
            }
        } else {
            tvEmpty.setVisibility(View.VISIBLE);
        }

        // Cập nhật Adapter
        if (adapter == null) {
            adapter = new OfflineMapAdapter(offlineMapList, map -> {
                // Click vào item để xem chi tiết
                Intent intent = new Intent(this, OfflineDetailActivity.class);
                intent.putExtra("path", map.imagePath);
                intent.putExtra("title", map.title);
                startActivity(intent);
            });
            rvOfflineMaps.setAdapter(adapter);
        } else {
            adapter.notifyDataSetChanged();
        }
    }
}