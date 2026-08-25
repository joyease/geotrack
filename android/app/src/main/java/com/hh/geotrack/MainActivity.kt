package com.hh.geotrack

import android.Manifest
import android.content.pm.PackageManager
import android.location.Location
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.GeoPoint
import com.google.firebase.firestore.Query
import java.text.SimpleDateFormat
import java.util.*

data class CheckInModel(
    val id: String = "",
    val userId: String = "",
    val userEmail: String = "",
    val tripCode: String = "",
    val location: GeoPoint? = null,
    val accuracy: Double = 0.0,
    val addressHint: String = "",
    val deviceModel: String = "",
    val timestamp: Date? = null
)

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        try {
            if (FirebaseApp.getApps(this).isEmpty()) {
                val options = FirebaseOptions.Builder()
                    .setApplicationId("1:133122521568:android:51d7db5ef2979686995385")
                    .setApiKey("AIzaSyBagcQG_7QSBvf0lSdYPmD4vH1VrOeToJY")
                    .setProjectId("geotrack-8e9b4")
                    .setStorageBucket("geotrack-8e9b4.appspot.com")
                    .build()
                FirebaseApp.initializeApp(this, options)
            }
        } catch (e: Exception) {
            try {
                FirebaseApp.initializeApp(this)
            } catch (_: Exception) {}
        }

        setContent {
            MaterialTheme(
                colorScheme = lightColorScheme(
                    primary = Color(0xFF6750A4),
                    onPrimary = Color.White,
                    primaryContainer = Color(0xFFEADDFF),
                    onPrimaryContainer = Color(0xFF21005D),
                    surface = Color(0xFFFEF7FF),
                    onSurface = Color(0xFF1D1B20)
                )
            ) {
                GeoTrackApp()
            }
        }
    }
}

@Composable
fun GeoTrackApp() {
    val context = LocalContext.current
    val firestore = remember { FirebaseFirestore.getInstance() }
    val fusedLocationClient = remember { LocationServices.getFusedLocationProviderClient(context) }

    var selectedTab by remember { mutableIntStateOf(0) }
    var userEmail by remember { mutableStateOf("hermanntalk@gmail.com") }
    var tripCode by remember { mutableStateOf("TAIPEI") }
    var currentLatitude by remember { mutableDoubleStateOf(25.033964) }
    var currentLongitude by remember { mutableDoubleStateOf(121.564468) }
    var currentAccuracy by remember { mutableFloatStateOf(4.5f) }
    var isLocating by remember { mutableStateOf(false) }
    var isSubmitting by remember { mutableStateOf(false) }
    var recentCheckIns by remember { mutableStateOf<List<CheckInModel>>(emptyList()) }

    // Query state for Map screen
    var mapQueryEmail by remember { mutableStateOf("hermanntalk@gmail.com") }
    var mapQueryTrip by remember { mutableStateOf("TAIPEI") }
    var searchResults by remember { mutableStateOf<List<CheckInModel>>(emptyList()) }
    var isSearching by remember { mutableStateOf(false) }

    // Fetch initial checkins
    fun loadRecentCheckIns() {
        firestore.collection("checkins")
            .orderBy("timestamp", Query.Direction.DESCENDING)
            .limit(10)
            .get()
            .addOnSuccessListener { snapshot ->
                val list = snapshot.documents.mapNotNull { doc ->
                    val loc = doc.getGeoPoint("location")
                    val ts = doc.getTimestamp("timestamp")?.toDate()
                    CheckInModel(
                        id = doc.id,
                        userId = doc.getString("userId") ?: "",
                        userEmail = doc.getString("userEmail") ?: "",
                        tripCode = doc.getString("tripCode") ?: "",
                        location = loc,
                        accuracy = doc.getDouble("accuracy") ?: 0.0,
                        addressHint = doc.getString("addressHint") ?: "",
                        deviceModel = doc.getString("deviceModel") ?: "",
                        timestamp = ts
                    )
                }
                recentCheckIns = list
            }
    }

    LaunchedEffect(Unit) {
        loadRecentCheckIns()
    }

    // Permission launcher
    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val granted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (granted) {
            Toast.makeText(context, "GPS 權限已授予", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(context, "請允許定位權限以取得精確座標", Toast.LENGTH_LONG).show()
        }
    }

    fun requestGpsLocation() {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            locationPermissionLauncher.launch(
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
            )
            return
        }

        isLocating = true
        val cts = CancellationTokenSource()
        try {
            fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cts.token)
                .addOnSuccessListener { location: Location? ->
                    isLocating = false
                    if (location != null) {
                        currentLatitude = location.latitude
                        currentLongitude = location.longitude
                        currentAccuracy = location.accuracy
                        Toast.makeText(context, "GPS 定位成功 (${String.format(Locale.US, "%.5f", currentLatitude)}, ${String.format(Locale.US, "%.5f", currentLongitude)})", Toast.LENGTH_SHORT).show()
                    } else {
                        Toast.makeText(context, "暫時無法取得 GPS 訊號，使用預設座標", Toast.LENGTH_SHORT).show()
                    }
                }
                .addOnFailureListener {
                    isLocating = false
                    Toast.makeText(context, "GPS 讀取失敗: ${it.localizedMessage}", Toast.LENGTH_SHORT).show()
                }
        } catch (e: SecurityException) {
            isLocating = false
        }
    }

    fun submitCheckIn() {
        if (tripCode.isBlank()) {
            Toast.makeText(context, "請輸入行程代碼", Toast.LENGTH_SHORT).show()
            return
        }

        isSubmitting = true
        val docData = hashMapOf(
            "userId" to userEmail.substringBefore("@"),
            "userEmail" to userEmail.trim(),
            "tripCode" to tripCode.trim().uppercase(Locale.ROOT),
            "location" to GeoPoint(currentLatitude, currentLongitude),
            "timestamp" to FieldValue.serverTimestamp(),
            "accuracy" to currentAccuracy.toDouble(),
            "addressHint" to "GPS Check-in point",
            "deviceModel" to "${Build.MANUFACTURER} ${Build.MODEL} (Android ${Build.VERSION.RELEASE})"
        )

        firestore.collection("checkins")
            .add(docData)
            .addOnSuccessListener {
                isSubmitting = false
                Toast.makeText(context, "打卡成功！已寫入 Firestore 雲端資料庫", Toast.LENGTH_LONG).show()
                loadRecentCheckIns()
            }
            .addOnFailureListener { e ->
                isSubmitting = false
                Toast.makeText(context, "打卡寫入失敗: ${e.localizedMessage}", Toast.LENGTH_LONG).show()
            }
    }

    fun searchFirestoreRecords() {
        isSearching = true
        var q: Query = firestore.collection("checkins")
        if (mapQueryEmail.isNotBlank()) {
            q = q.whereEqualTo("userEmail", mapQueryEmail.trim())
        }

        q.get()
            .addOnSuccessListener { snapshot ->
                isSearching = false
                val cleanTrip = mapQueryTrip.trim().uppercase(Locale.ROOT)
                val list = snapshot.documents.mapNotNull { doc ->
                    val loc = doc.getGeoPoint("location")
                    val ts = doc.getTimestamp("timestamp")?.toDate()
                    val trip = doc.getString("tripCode") ?: ""
                    if (cleanTrip.isEmpty() || trip.uppercase(Locale.ROOT) == cleanTrip) {
                        CheckInModel(
                            id = doc.id,
                            userId = doc.getString("userId") ?: "",
                            userEmail = doc.getString("userEmail") ?: "",
                            tripCode = trip,
                            location = loc,
                            accuracy = doc.getDouble("accuracy") ?: 0.0,
                            addressHint = doc.getString("addressHint") ?: "",
                            deviceModel = doc.getString("deviceModel") ?: "",
                            timestamp = ts
                        )
                    } else null
                }
                searchResults = list
                Toast.makeText(context, "找到 ${list.size} 筆打卡點", Toast.LENGTH_SHORT).show()
            }
            .addOnFailureListener { e ->
                isSearching = false
                Toast.makeText(context, "查詢失敗: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
            }
    }

    Scaffold(
        bottomBar = {
            NavigationBar(
                containerColor = Color(0xFFFEF7FF)
            ) {
                NavigationBarItem(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    icon = { Icon(Icons.Default.LocationOn, contentDescription = "定位打卡") },
                    label = { Text("定位打卡") }
                )
                NavigationBarItem(
                    selected = selectedTab == 1,
                    onClick = {
                        selectedTab = 1
                        if (searchResults.isEmpty()) searchFirestoreRecords()
                    },
                    icon = { Icon(Icons.Default.Map, contentDescription = "打卡地圖") },
                    label = { Text("打卡地圖") }
                )
                NavigationBarItem(
                    selected = selectedTab == 2,
                    onClick = { selectedTab = 2 },
                    icon = { Icon(Icons.Default.Person, contentDescription = "關於我") },
                    label = { Text("關於我") }
                )
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(Color(0xFFFBF8FD))
        ) {
            when (selectedTab) {
                0 -> {
                    // Screen: 定位打卡
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        item {
                            Text(
                                text = "定位打卡",
                                style = MaterialTheme.typography.headlineMedium,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF1D1B20)
                            )
                        }

                        item {
                            Card(
                                shape = RoundedCornerShape(20.dp),
                                colors = CardDefaults.cardColors(containerColor = Color.White),
                                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(
                                    modifier = Modifier.padding(16.dp),
                                    verticalArrangement = Arrangement.spacedBy(12.dp)
                                ) {
                                    OutlinedTextField(
                                        value = userEmail,
                                        onValueChange = { userEmail = it },
                                        label = { Text("使用者帳號 (Email)") },
                                        singleLine = true,
                                        modifier = Modifier.fillMaxWidth(),
                                        shape = RoundedCornerShape(12.dp)
                                    )

                                    OutlinedTextField(
                                        value = tripCode,
                                        onValueChange = { tripCode = it.uppercase(Locale.ROOT) },
                                        label = { Text("行程代碼 (Trip Code)") },
                                        placeholder = { Text("例: TAIPEI") },
                                        singleLine = true,
                                        modifier = Modifier.fillMaxWidth(),
                                        shape = RoundedCornerShape(12.dp)
                                    )

                                    // GPS Coord display
                                    Surface(
                                        shape = RoundedCornerShape(12.dp),
                                        color = Color(0xFFF3EDF7),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(12.dp),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Column {
                                                Text(
                                                    text = "GPS 座標",
                                                    fontSize = 11.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = Color(0xFF49454F)
                                                )
                                                Text(
                                                    text = "${String.format(Locale.US, "%.5f", currentLatitude)}, ${String.format(Locale.US, "%.5f", currentLongitude)}",
                                                    fontFamily = FontFamily.Monospace,
                                                    fontSize = 13.sp,
                                                    fontWeight = FontWeight.SemiBold,
                                                    color = Color(0xFF6750A4)
                                                )
                                            }

                                            Button(
                                                onClick = { requestGpsLocation() },
                                                enabled = !isLocating,
                                                shape = RoundedCornerShape(10.dp),
                                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                                            ) {
                                                Text(if (isLocating) "定位中..." else "更新 GPS")
                                            }
                                        }
                                    }

                                    Button(
                                        onClick = { submitCheckIn() },
                                        enabled = !isSubmitting,
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(52.dp),
                                        shape = RoundedCornerShape(14.dp),
                                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF6750A4))
                                    ) {
                                        Icon(Icons.Default.Send, contentDescription = null, modifier = Modifier.size(18.dp))
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text(if (isSubmitting) "打卡中..." else "確認打卡 (存入 Firestore)", fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }

                        item {
                            Text(
                                text = "最近打卡",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF49454F)
                            )
                        }

                        items(recentCheckIns) { record ->
                            Card(
                                shape = RoundedCornerShape(14.dp),
                                colors = CardDefaults.cardColors(containerColor = Color.White),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Surface(
                                        shape = CircleShape,
                                        color = Color(0xFFEADDFF),
                                        modifier = Modifier.size(36.dp)
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Icon(Icons.Default.LocationOn, contentDescription = null, tint = Color(0xFF6750A4), modifier = Modifier.size(20.dp))
                                        }
                                    }
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Text(
                                                text = record.tripCode,
                                                fontWeight = FontWeight.Bold,
                                                color = Color(0xFF6750A4),
                                                fontSize = 13.sp
                                            )
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Text(
                                                text = record.userEmail.substringBefore("@"),
                                                fontSize = 12.sp,
                                                color = Color(0xFF49454F)
                                            )
                                        }
                                        val locStr = record.location?.let { "${String.format(Locale.US, "%.4f", it.latitude)}, ${String.format(Locale.US, "%.4f", it.longitude)}" } ?: "無座標"
                                        Text(text = locStr, fontSize = 11.sp, fontFamily = FontFamily.Monospace, color = Color(0xFF79747E))
                                    }
                                    val timeStr = record.timestamp?.let { SimpleDateFormat("HH:mm", Locale.getDefault()).format(it) } ?: ""
                                    Text(text = timeStr, fontSize = 11.sp, color = Color(0xFF79747E))
                                }
                            }
                        }
                    }
                }
                1 -> {
                    // Screen: 打卡地圖
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Text(
                            text = "打卡地圖",
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF1D1B20)
                        )

                        Card(
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(
                                modifier = Modifier.padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                OutlinedTextField(
                                    value = mapQueryEmail,
                                    onValueChange = { mapQueryEmail = it },
                                    label = { Text("使用者 Email") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(10.dp)
                                )
                                OutlinedTextField(
                                    value = mapQueryTrip,
                                    onValueChange = { mapQueryTrip = it.uppercase(Locale.ROOT) },
                                    label = { Text("行程代碼") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(10.dp)
                                )
                                Button(
                                    onClick = { searchFirestoreRecords() },
                                    enabled = !isSearching,
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(10.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF6750A4))
                                ) {
                                    Icon(Icons.Default.Search, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(if (isSearching) "查詢中..." else "查詢打卡路線")
                                }
                            }
                        }

                        // Search Results List
                        Text(
                            text = "查詢結果 (${searchResults.size} 筆)",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF49454F)
                        )

                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            items(searchResults) { r ->
                                Card(
                                    shape = RoundedCornerShape(12.dp),
                                    colors = CardDefaults.cardColors(containerColor = Color.White),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Column(modifier = Modifier.padding(12.dp)) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            Text(
                                                text = "${r.userEmail.substringBefore("@")} (${r.tripCode})",
                                                fontWeight = FontWeight.Bold,
                                                color = Color(0xFF1D1B20),
                                                fontSize = 13.sp
                                            )
                                            val tStr = r.timestamp?.let { SimpleDateFormat("yyyy/MM/dd HH:mm", Locale.getDefault()).format(it) } ?: ""
                                            Text(text = tStr, fontSize = 11.sp, color = Color(0xFF6750A4), fontWeight = FontWeight.SemiBold)
                                        }
                                        val locInfo = r.location?.let { "經緯度: ${it.latitude}, ${it.longitude}" } ?: "無座標"
                                        Text(text = locInfo, fontSize = 11.sp, fontFamily = FontFamily.Monospace, color = Color(0xFF49454F))
                                        if (r.deviceModel.isNotBlank()) {
                                            Text(text = "裝置: ${r.deviceModel}", fontSize = 10.sp, color = Color(0xFF79747E))
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                2 -> {
                    // Screen: 關於我
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Text(
                            text = "關於我",
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF1D1B20),
                            modifier = Modifier.align(Alignment.Start)
                        )

                        Surface(
                            shape = CircleShape,
                            color = Color(0xFF6750A4),
                            modifier = Modifier.size(80.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text(
                                    text = userEmail.take(2).uppercase(Locale.ROOT),
                                    color = Color.White,
                                    fontSize = 28.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }

                        Text(
                            text = userEmail,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            color = Color(0xFF1D1B20)
                        )

                        Surface(
                            shape = RoundedCornerShape(20.dp),
                            color = Color(0xFFEADDFF),
                            modifier = Modifier.padding(4.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF2E7D32), modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(text = "Firebase Firestore 已連線", fontSize = 12.sp, color = Color(0xFF21005D), fontWeight = FontWeight.Bold)
                            }
                        }

                        Card(
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text(text = "專案環境資訊", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                Text(text = "• Firebase 專案: geotrack-8e9b4", fontSize = 12.sp, color = Color(0xFF49454F))
                                Text(text = "• 套件名稱: com.hh.geotrack", fontSize = 12.sp, color = Color(0xFF49454F))
                                Text(text = "• 資料庫集合: checkins", fontSize = 12.sp, color = Color(0xFF49454F))
                            }
                        }
                    }
                }
            }
        }
    }
}
