package com.example.traffigo.activities;

import android.content.Intent;
import android.os.Bundle;
import android.widget.Button;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.viewpager2.widget.ViewPager2;

import com.example.traffigo.R;
import com.example.traffigo.adapters.OnboardingAdapter;
import com.example.traffigo.models.OnboardingItem;
import com.tbuonomo.viewpagerdotsindicator.DotsIndicator;

import java.util.ArrayList;
import java.util.List;

public class OnboardingActivity extends AppCompatActivity {

    private ViewPager2 onboardingViewPager;
    private Button btnNext;
    private TextView btnSignIn, tvSkip;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_onboarding);

        // Ánh xạ View
        onboardingViewPager = findViewById(R.id.viewPager);
        btnNext = findViewById(R.id.btnNext);
        btnSignIn = findViewById(R.id.btnSignIn);
        tvSkip = findViewById(R.id.tvSkip); // Nếu bạn có nút Skip ở góc trên

        DotsIndicator dotsIndicator = findViewById(R.id.dots_indicator);

        // Chuẩn bị dữ liệu
        List<OnboardingItem> onboardingItems = new ArrayList<>();
        onboardingItems.add(new OnboardingItem(
                R.drawable.onboarding_route,
                "Finding Your Way Just Got Easier",
                "Discover the best routes, avoid traffic and reach your destination faster."
        ));
        onboardingItems.add(new OnboardingItem(
                R.drawable.onboarding_traffic,
                "Real-Time Traffic Updates",
                "Get live traffic conditions, road incidents and smart route suggestions."
        ));
        onboardingItems.add(new OnboardingItem(
                R.drawable.onboarding_journey,
                "Start Your Journey",
                "Navigate the city with accurate directions and reliable road information."
        ));

        // Cài đặt Adapter
        OnboardingAdapter adapter = new OnboardingAdapter(onboardingItems);
        onboardingViewPager.setAdapter(adapter);

        // Kết nối DotsIndicator với ViewPager2 (Chỉ dùng cái này, bỏ TabLayoutMediator)
        dotsIndicator.attachTo(onboardingViewPager);

        // Xử lý nút Continue (Next)
        btnNext.setOnClickListener(v -> {
            int currentItem = onboardingViewPager.getCurrentItem();
            if (currentItem < adapter.getItemCount() - 1) {
                onboardingViewPager.setCurrentItem(currentItem + 1);
            } else {
                navigateToLogin();
            }
        });

        // Xử lý nút Sign In
        btnSignIn.setOnClickListener(v -> navigateToLogin());

        // Thay đổi text nút khi đến trang cuối (Tùy chọn)
        onboardingViewPager.registerOnPageChangeCallback(new ViewPager2.OnPageChangeCallback() {
            @Override
            public void onPageSelected(int position) {
                super.onPageSelected(position);
                if (position == adapter.getItemCount() - 1) {
                    btnNext.setText("Get Started");
                } else {
                    btnNext.setText("Continue");
                }
            }
        });
    }

    private void navigateToLogin() {
        Intent intent = new Intent(OnboardingActivity.this, LoginActivity.class);
        startActivity(intent);
        finish(); // Đóng luôn màn hình Onboarding
    }
}