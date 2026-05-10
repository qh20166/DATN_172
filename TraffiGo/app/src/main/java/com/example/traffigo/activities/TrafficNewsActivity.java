package com.example.traffigo.activities;

import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.bumptech.glide.Glide;
import com.example.traffigo.R;
import com.example.traffigo.models.NewsItem;

import org.xmlpull.v1.XmlPullParser;
import org.xmlpull.v1.XmlPullParserFactory;

import java.io.StringReader;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

public class TrafficNewsActivity extends AppCompatActivity {

    private RecyclerView rvNews;
    private NewsAdapter adapter;
    private final List<NewsItem> newsList = new ArrayList<>();
    private final ExecutorService executor = Executors.newFixedThreadPool(3); // Tăng luồng để tải song song

    // DANH SÁCH CÁC NGUỒN RSS UY TÍN
    private final String[] RSS_URLS = {
            "https://vnexpress.net/rss/giao-thong.rss",
            "https://thanhnien.vn/rss/giao-thong.rss" // Tuổi trẻ thường gộp giao thông vào đây
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_traffic_news);

        setupHeader();

        rvNews = findViewById(R.id.rvNews);
        rvNews.setLayoutManager(new LinearLayoutManager(this));
        adapter = new NewsAdapter(newsList);
        rvNews.setAdapter(adapter);

        fetchAllNews();
    }

    private void setupHeader() {
        TextView tvTitle = findViewById(R.id.tvPageTitle);
        if (tvTitle != null) tvTitle.setText("TIN TỨC TỔNG HỢP");
        findViewById(R.id.btnBack).setOnClickListener(v -> finish());

        View btnShare = findViewById(R.id.btnShare);
        if (btnShare != null) btnShare.setVisibility(View.GONE);
    }

    private void fetchAllNews() {
        newsList.clear(); // Xóa cũ trước khi tải mới
        for (String url : RSS_URLS) {
            fetchNewsFromSource(url);
        }
    }

    private void fetchNewsFromSource(String url) {
        executor.execute(() -> {
            try {
                OkHttpClient client = new OkHttpClient();
                Request request = new Request.Builder()
                        .url(url)
                        .header("User-Agent", "Mozilla/5.0")
                        .build();

                Response response = client.newCall(request).execute();
                if (response.body() != null) {
                    String xml = response.body().string();
                    parseXml(xml);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }

    private synchronized void parseXml(String xml) {
        try {
            XmlPullParserFactory factory = XmlPullParserFactory.newInstance();
            XmlPullParser parser = factory.newPullParser();
            parser.setInput(new StringReader(xml.trim()));

            int eventType = parser.getEventType();
            NewsItem item = null;
            String text = "";

            while (eventType != XmlPullParser.END_DOCUMENT) {
                String tag = parser.getName();
                if (eventType == XmlPullParser.START_TAG) {
                    if ("item".equalsIgnoreCase(tag)) item = new NewsItem("", "", "", "", "");
                } else if (eventType == XmlPullParser.TEXT) {
                    text = parser.getText();
                } else if (eventType == XmlPullParser.END_TAG && item != null) {
                    switch (tag.toLowerCase()) {
                        case "title": item.title = text; break;
                        case "link": item.link = text; break;
                        case "pubdate": item.pubDate = text.replace(" +0700", ""); break;
                        case "description":
                            // Trích xuất ảnh (VnExpress & Thanh Niên thường để ảnh trong thẻ <img>)
                            Pattern p = Pattern.compile("<img[^>]+src=\"([^\"]+)\"");
                            Matcher m = p.matcher(text);
                            if (m.find()) item.imageUrl = m.group(1);
                            item.description = text.replaceAll("<[^>]*>", "").trim();
                            break;
                        case "item":
                            newsList.add(item);
                            break;
                    }
                }
                eventType = parser.next();
            }
            // Sắp xếp lại danh sách (Tùy chọn: có thể sắp xếp theo ngày tháng nếu muốn)
            runOnUiThread(() -> adapter.notifyDataSetChanged());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // --- Giữ nguyên Adapter và ViewHolder từ code của bạn ---
    private class NewsAdapter extends RecyclerView.Adapter<NewsAdapter.VH> {
        List<NewsItem> list;
        NewsAdapter(List<NewsItem> list) { this.list = list; }

        @NonNull
        @Override
        public VH onCreateViewHolder(@NonNull ViewGroup p, int t) {
            return new VH(LayoutInflater.from(p.getContext()).inflate(R.layout.item_news, p, false));
        }

        @Override
        public void onBindViewHolder(@NonNull VH h, int pos) {
            NewsItem i = list.get(pos);
            h.t.setText(i.title);
            h.d.setText(i.description);
            h.p.setText(i.pubDate);
            Glide.with(TrafficNewsActivity.this).load(i.imageUrl).centerCrop()
                    .placeholder(android.R.color.darker_gray).into(h.i);
            h.itemView.setOnClickListener(v -> {
                Intent intent = new Intent(TrafficNewsActivity.this, NewsDetailActivity.class);
                intent.putExtra("news_url", i.link);
                startActivity(intent);
            });
        }

        @Override
        public int getItemCount() { return list.size(); }

        class VH extends RecyclerView.ViewHolder {
            TextView t, d, p; ImageView i;
            VH(View v) {
                super(v);
                t = v.findViewById(R.id.tvNewsTitle);
                d = v.findViewById(R.id.tvNewsDesc);
                p = v.findViewById(R.id.tvPubDate);
                i = v.findViewById(R.id.imgNews);
            }
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        executor.shutdown();
    }
}