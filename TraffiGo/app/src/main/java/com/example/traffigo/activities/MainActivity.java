package com.example.traffigo.activities;

import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.RenderEffect;
import android.graphics.Shader;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import com.example.traffigo.R;
import com.example.traffigo.databinding.ActivityMainBinding;
import com.example.traffigo.utils.AppearanceHelper;
import com.google.android.material.bottomsheet.BottomSheetDialog;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;

import java.util.Calendar;

public class MainActivity extends AppCompatActivity {

    private ActivityMainBinding binding;
    private FirebaseAuth mAuth;
    private FirebaseUser currentUser;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 1. Làm Status Bar trong suốt
        makeStatusBarTransparent();

        binding = ActivityMainBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        // 2. Khởi tạo Firebase
        mAuth = FirebaseAuth.getInstance();
        currentUser = mAuth.getCurrentUser();

        if (currentUser == null) {
            startActivity(new Intent(this, OnboardingActivity.class));
            finish();
            return;
        }

        // 3. Áp dụng giao diện và hiệu ứng
        applyCustomAppearance();
        applyGlassBlur();
        updateUI(currentUser);
        setupListeners();
    }

    private void makeStatusBarTransparent() {
        Window window = getWindow();
        window.getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        window.setStatusBarColor(Color.TRANSPARENT);
    }

    private void applyGlassBlur() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            float blurRadius = 35f;
            RenderEffect blurEffect = RenderEffect.createBlurEffect(blurRadius, blurRadius, Shader.TileMode.MIRROR);
            if (binding.bgNav != null) binding.bgNav.setRenderEffect(blurEffect);
            if (binding.bgMap != null) binding.bgMap.setRenderEffect(blurEffect);
            if (binding.bgNews != null) binding.bgNews.setRenderEffect(blurEffect);
            if (binding.bgOffline != null) binding.bgOffline.setRenderEffect(blurEffect);
        }
    }

    private void updateUI(FirebaseUser user) {
        int hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
        String greeting = (hour < 12) ? "Chào buổi sáng," : (hour < 18) ? "Chào buổi chiều," : "Chào buổi tối,";
        binding.tvGreeting.setText(greeting);

        String name = (user.getDisplayName() != null && !user.getDisplayName().isEmpty())
                ? user.getDisplayName() : user.getEmail().split("@")[0];
        binding.tvUserName.setText(name);
    }

    private void setupListeners() {
        binding.btnGoToNavigation.setOnClickListener(v -> startActivity(new Intent(this, NavigationActivity.class)));
        binding.btnGoToTrafficMap.setOnClickListener(v -> startActivity(new Intent(this, TrafficMapActivity.class)));
        binding.btnGoToNews.setOnClickListener(v -> startActivity(new Intent(this, TrafficNewsActivity.class)));

        // Listener cho tính năng mới: Bản đồ ngoại tuyến
        binding.btnGoToOfflineMaps.setOnClickListener(v -> startActivity(new Intent(this, OfflineMapsActivity.class)));

        if (binding.btnAccount != null) {
            binding.btnAccount.setOnClickListener(v -> showAccountBottomSheet());
        }
    }

    private void applyCustomAppearance() {
        // Áp dụng ảnh nền
        int savedBg = AppearanceHelper.getCustomBackground(this, R.drawable.bg_gradient_main);
        binding.mainLayout.setBackgroundResource(savedBg);

        // Áp dụng màu thẻ (Độ đậm 50% để không bị tàng hình)
        String savedCardHex = AppearanceHelper.getCustomCardColor(this, "#80FFFFFF");
        ColorStateList cardColorList = ColorStateList.valueOf(Color.parseColor(savedCardHex));

        if (binding.bgNav != null) binding.bgNav.setBackgroundTintList(cardColorList);
        if (binding.bgMap != null) binding.bgMap.setBackgroundTintList(cardColorList);
        if (binding.bgNews != null) binding.bgNews.setBackgroundTintList(cardColorList);
        if (binding.bgOffline != null) binding.bgOffline.setBackgroundTintList(cardColorList);

        // Áp dụng màu chữ đồng bộ
        String savedTextColorHex = AppearanceHelper.getCustomTextColor(this, "#FFFFFF");
        int textColor = Color.parseColor(savedTextColorHex);
        int subTextColor = Color.argb(180, Color.red(textColor), Color.green(textColor), Color.blue(textColor));

        if (binding.tvGreeting != null) binding.tvGreeting.setTextColor(subTextColor);
        if (binding.tvUserName != null) binding.tvUserName.setTextColor(textColor);
        if (binding.tvTitleNav != null) binding.tvTitleNav.setTextColor(textColor);
        if (binding.tvSubNav != null) binding.tvSubNav.setTextColor(subTextColor);
        if (binding.tvTitleMap != null) binding.tvTitleMap.setTextColor(textColor);
        if (binding.tvTitleNews != null) binding.tvTitleNews.setTextColor(textColor);
        if (binding.tvTitleOffline != null) binding.tvTitleOffline.setTextColor(textColor);
    }

    private void showAccountBottomSheet() {
        BottomSheetDialog dialog = new BottomSheetDialog(this, R.style.BottomSheetDialogTheme);
        View view = getLayoutInflater().inflate(R.layout.layout_bottom_sheet_account, null);
        dialog.setContentView(view);

        TextView tvName = view.findViewById(R.id.tvSheetName);
        TextView tvEmail = view.findViewById(R.id.tvSheetEmail);

        if (currentUser != null) {
            String name = (currentUser.getDisplayName() != null && !currentUser.getDisplayName().isEmpty())
                    ? currentUser.getDisplayName() : currentUser.getEmail().split("@")[0];
            tvName.setText(name);
            tvEmail.setText(currentUser.getEmail());
        }
        view.findViewById(R.id.btnProfile).setOnClickListener(v -> {
            // 1. Đóng dialog ngay lập tức
            dialog.dismiss();

            // 2. Tạo Intent để mở ProfileActivity
            // Dùng v.getContext() để đảm bảo lấy đúng ngữ cảnh từ View
            Intent intent = new Intent(v.getContext(), ProfileActivity.class);

            // 3. Chạy Activity
            v.getContext().startActivity(intent);

            // (Tùy chọn) Thêm hiệu ứng chuyển cảnh cho mượt
            // ((Activity) v.getContext()).overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out);
        });
        view.findViewById(R.id.btnSetting).setOnClickListener(v -> {
            dialog.dismiss();
            showCustomizeBottomSheet();
        });

        view.findViewById(R.id.btnLogout).setOnClickListener(v -> {
            dialog.dismiss();
            performLogout();
        });

        if(dialog.getWindow() != null) {
            dialog.getWindow().findViewById(com.google.android.material.R.id.design_bottom_sheet).setBackgroundResource(android.R.color.transparent);
        }
        dialog.show();
    }

    private void showCustomizeBottomSheet() {
        BottomSheetDialog dialog = new BottomSheetDialog(this, R.style.BottomSheetDialogTheme);
        View sheetView = getLayoutInflater().inflate(R.layout.layout_bottom_sheet_customize, null);
        dialog.setContentView(sheetView);

        // 1. Đổi Ảnh Nền
        sheetView.findViewById(R.id.btnBg1).setOnClickListener(v -> {
            AppearanceHelper.saveCustomBackground(this, R.drawable.bg_gradient_main);
            applyCustomAppearance();
        });
        sheetView.findViewById(R.id.btnBg2).setOnClickListener(v -> {
            AppearanceHelper.saveCustomBackground(this, R.drawable.bg_white_main);
            applyCustomAppearance();
        });

        // 2. Đổi Màu Ô (Dùng #80)
        sheetView.findViewById(R.id.btnColorWhite).setOnClickListener(v -> {
            AppearanceHelper.saveCustomCardColor(this, "#80FFFFFF");
            applyCustomAppearance();
        });
        sheetView.findViewById(R.id.btnColorBlack).setOnClickListener(v -> {
            AppearanceHelper.saveCustomCardColor(this, "#80000000");
            applyCustomAppearance();
        });
        sheetView.findViewById(R.id.btnColorBlue).setOnClickListener(v -> {
            AppearanceHelper.saveCustomCardColor(this, "#8000BFFF");
            applyCustomAppearance();
        });
        sheetView.findViewById(R.id.btnColorPurple).setOnClickListener(v -> {
            AppearanceHelper.saveCustomCardColor(this, "#808A2BE2");
            applyCustomAppearance();
        });

        // 3. Đổi Màu Chữ (Đồng bộ)
        sheetView.findViewById(R.id.btnTextColorWhite).setOnClickListener(v -> {
            AppearanceHelper.saveCustomTextColor(this, "#FFFFFF");
            applyCustomAppearance();
        });
        sheetView.findViewById(R.id.btnTextColorBlack).setOnClickListener(v -> {
            AppearanceHelper.saveCustomTextColor(this, "#212121");
            applyCustomAppearance();
        });
        sheetView.findViewById(R.id.btnTextColorYellow).setOnClickListener(v -> {
            AppearanceHelper.saveCustomTextColor(this, "#FFEB3B");
            applyCustomAppearance();
        });

        if(dialog.getWindow() != null) {
            dialog.getWindow().findViewById(com.google.android.material.R.id.design_bottom_sheet).setBackgroundResource(android.R.color.transparent);
        }
        dialog.show();
    }

    private void performLogout() {
        mAuth.signOut();
        Intent intent = new Intent(this, OnboardingActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
        finish();
    }
}