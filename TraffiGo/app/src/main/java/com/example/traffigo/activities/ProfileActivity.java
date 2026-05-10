package com.example.traffigo.activities;

import android.app.ProgressDialog;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;

import com.example.traffigo.databinding.ActivityProfileBinding;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.auth.UserProfileChangeRequest;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.storage.FirebaseStorage;
import com.google.firebase.storage.StorageReference;

public class ProfileActivity extends AppCompatActivity {

    // Khai báo ViewBinding thay cho các View đơn lẻ
    private ActivityProfileBinding binding;

    private FirebaseAuth mAuth;
    private DatabaseReference userRef;
    private Uri selectedImageUri = null;

    private final ActivityResultLauncher<String> pickImageLauncher = registerForActivityResult(
            new ActivityResultContracts.GetContent(),
            uri -> {
                if (uri != null) {
                    selectedImageUri = uri;
                    // Gọi trực tiếp id qua binding
                    binding.imgAvatar.setImageURI(uri);
                }
            }
    );

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Khởi tạo Binding
        binding = ActivityProfileBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        mAuth = FirebaseAuth.getInstance();
        if (mAuth.getCurrentUser() != null) {
            userRef = FirebaseDatabase.getInstance().getReference("Users").child(mAuth.getCurrentUser().getUid());
        }

        setupHeader();
        setupListeners();
        loadUserData();
    }

    private void setupHeader() {
        // Tương tác trực tiếp với thẻ <include> mang id là layoutHeader
        binding.layoutHeader.tvPageTitle.setText("Hồ Sơ Cá Nhân");

        // Ẩn nút Share vì trang Profile thường không cần thiết
        if (binding.layoutHeader.btnShare != null) {
            binding.layoutHeader.btnShare.setVisibility(View.GONE);
        }

        binding.layoutHeader.btnBack.setOnClickListener(v -> finish());

        // Không cho phép sửa Email trực tiếp
        binding.edtEmail.setEnabled(false);
    }

    private void setupListeners() {
        // Cả ảnh và dòng chữ "Đổi ảnh đại diện" đều mở thư viện ảnh
        binding.imgAvatar.setOnClickListener(v -> pickImageLauncher.launch("image/*"));
        binding.btnChangePicture.setOnClickListener(v -> pickImageLauncher.launch("image/*"));

        binding.btnSaveChanges.setOnClickListener(v -> {
            String newName = binding.edtName.getText().toString().trim();
            String newPhone = binding.edtPhone.getText().toString().trim();

            if (newName.isEmpty()) {
                Toast.makeText(this, "Tên không được để trống!", Toast.LENGTH_SHORT).show();
                return;
            }

            saveDataToFirebase(newName, newPhone, selectedImageUri);
        });
    }

    private void loadUserData() {
        FirebaseUser user = mAuth.getCurrentUser();
        if (user != null) {
            binding.edtName.setText(user.getDisplayName() != null ? user.getDisplayName() : "");
            binding.edtEmail.setText(user.getEmail() != null ? user.getEmail() : "");

            // Gợi ý: Sau này dùng Glide load ảnh thì dùng dòng này:
            // if (user.getPhotoUrl() != null) {
            //      Glide.with(this).load(user.getPhotoUrl()).into(binding.imgAvatar);
            // }

            if (userRef != null) {
                userRef.child("phone").get().addOnSuccessListener(dataSnapshot -> {
                    if (dataSnapshot.exists()) {
                        binding.edtPhone.setText(dataSnapshot.getValue(String.class));
                    }
                });
            }
        }
    }

    private void saveDataToFirebase(String name, String phone, Uri imageUri) {
        FirebaseUser user = mAuth.getCurrentUser();
        if (user == null) return;

        ProgressDialog loadingDialog = new ProgressDialog(this);
        loadingDialog.setMessage("Đang cập nhật thông tin...");
        loadingDialog.setCancelable(false);
        loadingDialog.show();

        if (imageUri != null) {
            StorageReference fileRef = FirebaseStorage.getInstance().getReference()
                    .child("profile_images")
                    .child(user.getUid() + ".jpg");

            fileRef.putFile(imageUri).addOnSuccessListener(taskSnapshot -> {
                fileRef.getDownloadUrl().addOnSuccessListener(downloadUri -> {
                    updateAuthAndDatabase(user, name, phone, downloadUri, loadingDialog);
                });
            }).addOnFailureListener(e -> {
                loadingDialog.dismiss();
                Toast.makeText(this, "Lỗi up ảnh: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            });
        } else {
            updateAuthAndDatabase(user, name, phone, null, loadingDialog);
        }
    }

    private void updateAuthAndDatabase(FirebaseUser user, String name, String phone, Uri photoUrl, ProgressDialog dialog) {
        UserProfileChangeRequest.Builder profileUpdates = new UserProfileChangeRequest.Builder()
                .setDisplayName(name);

        if (photoUrl != null) {
            profileUpdates.setPhotoUri(photoUrl);
        }

        user.updateProfile(profileUpdates.build()).addOnCompleteListener(task -> {
            if (task.isSuccessful()) {
                if (userRef != null && !phone.isEmpty()) {
                    userRef.child("phone").setValue(phone).addOnCompleteListener(dbTask -> {
                        dialog.dismiss();
                        if (dbTask.isSuccessful()) {
                            Toast.makeText(ProfileActivity.this, "Cập nhật thành công!", Toast.LENGTH_SHORT).show();
                        } else {
                            Toast.makeText(ProfileActivity.this, "Lỗi lưu SĐT: " + dbTask.getException().getMessage(), Toast.LENGTH_SHORT).show();
                        }
                    });
                } else {
                    dialog.dismiss();
                    Toast.makeText(ProfileActivity.this, "Cập nhật tên và ảnh thành công!", Toast.LENGTH_SHORT).show();
                }
            } else {
                dialog.dismiss();
                Toast.makeText(ProfileActivity.this, "Lỗi cập nhật Profile: " + task.getException().getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }
}