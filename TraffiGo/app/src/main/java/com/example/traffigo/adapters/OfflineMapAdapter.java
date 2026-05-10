package com.example.traffigo.adapters;

import android.graphics.BitmapFactory;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import com.example.traffigo.R;
import com.example.traffigo.models.OfflineMap;
import java.io.File;
import java.util.List;

public class OfflineMapAdapter extends RecyclerView.Adapter<OfflineMapAdapter.ViewHolder> {
    private List<OfflineMap> maps;
    private OnItemClickListener listener;

    public interface OnItemClickListener {
        void onItemClick(OfflineMap map);
    }

    public OfflineMapAdapter(List<OfflineMap> maps, OnItemClickListener listener) {
        this.maps = maps;
        this.listener = listener;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View v = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_offline_map, parent, false);
        return new ViewHolder(v);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        OfflineMap map = maps.get(position);
        holder.tvName.setText(map.title);
        holder.tvDate.setText(map.dateTime);
        holder.imgThumb.setImageBitmap(BitmapFactory.decodeFile(map.imagePath));
        holder.itemView.setOnClickListener(v -> listener.onItemClick(map));
    }

    @Override
    public int getItemCount() { return maps.size(); }

    public static class ViewHolder extends RecyclerView.ViewHolder {
        ImageView imgThumb;
        TextView tvName, tvDate;
        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            imgThumb = itemView.findViewById(R.id.imgThumb);
            tvName = itemView.findViewById(R.id.tvMapName);
            tvDate = itemView.findViewById(R.id.tvMapDate);
        }
    }
}