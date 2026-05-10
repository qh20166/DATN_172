package com.example.traffigo.activities;

import android.graphics.BitmapFactory;
import android.os.Bundle;
import android.view.View;
import android.widget.ImageButton;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import com.example.traffigo.R;
import com.github.chrisbanes.photoview.PhotoView;

public class OfflineDetailActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_offline_detail);

        // 1. Lấy dữ liệu từ Intent
        String path = getIntent().getStringExtra("path");
        String title = getIntent().getStringExtra("title");

        // 2. Ánh xạ View
        PhotoView photoView = findViewById(R.id.imgFullMap);

        // --- XỬ LÝ HEADER ---
        View header = findViewById(R.id.layoutHeader);
        TextView tvHeaderTitle = header.findViewById(R.id.tvPageTitle);
        ImageButton btnBack = header.findViewById(R.id.btnBack);

        if (tvHeaderTitle != null) tvHeaderTitle.setText("Bản đồ chi tiết");
        if (btnBack != null) btnBack.setOnClickListener(v -> finish());
        // --------------------

        // 3. Đổ dữ liệu
        if (path != null) {
            photoView.setImageBitmap(BitmapFactory.decodeFile(path));
        }
    }
}