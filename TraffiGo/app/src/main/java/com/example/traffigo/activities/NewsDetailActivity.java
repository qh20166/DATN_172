package com.example.traffigo.activities;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import com.example.traffigo.R;

public class NewsDetailActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_news_detail);

        String url = getIntent().getStringExtra("news_url");
        WebView webView = findViewById(R.id.webViewNews);
        TextView tvSource = findViewById(R.id.tvSource);

        // Hiển thị nguồn dựa trên link
        if (url.contains("thanhnien.vn")) tvSource.setText("Nguồn: Báo Thanh Niên");
        else if (url.contains("vnexpress.net")) tvSource.setText("Nguồn: VnExpress");

        // Cấu hình WebView để lướt mượt
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true); // Cho phép chạy JS để hiện nội dung
        settings.setDomStorageEnabled(true); // Lưu trữ dữ liệu web
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);

        webView.setWebViewClient(new WebViewClient()); // Mở link ngay trong app
        webView.loadUrl(url);

        findViewById(R.id.btnBackDetail).setOnClickListener(v -> finish());
    }
}