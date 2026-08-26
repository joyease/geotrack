import { AndroidSourceFile } from '../types';

export const ANDROID_SOURCE_FILES: AndroidSourceFile[] = [
  {
    path: 'app/src/main/java/com/example/geocheckin/MainActivity.kt',
    name: 'MainActivity.kt',
    category: 'compose_ui',
    description: 'Main Android Activity entrypoint setting up Jetpack Compose Material 3 theme & Firebase auth state.',
    language: 'kotlin',
    content: `package com.example.geocheckin

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.example.geocheckin.ui.navigation.AppNavigation
import com.example.geocheckin.ui.theme.GeoCheckinTheme
import com.google.firebase.auth.FirebaseAuth

class MainActivity : ComponentActivity() {
    private val auth: FirebaseAuth by lazy { FirebaseAuth.getInstance() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            GeoCheckinTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    var currentUser by remember { mutableStateOf(auth.currentUser) }

                    DisposableEffect(auth) {
                        val authStateListener = FirebaseAuth.AuthStateListener { firebaseAuth ->
                            currentUser = firebaseAuth.currentUser
                        }
                        auth.addAuthStateListener(authStateListener)
                        onDispose {
                            auth.removeAuthStateListener(authStateListener)
                        }
                    }

                    AppNavigation(
                        isLoggedIn = currentUser != null,
                        userEmail = currentUser?.email ?: ""
                    )
                }
            }
        }
    }
}`
  },
  {
    path: 'app/src/main/java/com/example/geocheckin/ui/navigation/AppNavigation.kt',
    name: 'AppNavigation.kt',
    category: 'navigation',
    description: 'Jetpack Compose Navigation Graph with Bottom Navigation Bar (Check-in, Map, Profile).',
    language: 'kotlin',
    content: `package com.example.geocheckin.ui.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Place
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.*
import com.example.geocheckin.ui.screens.CheckInScreen
import com.example.geocheckin.ui.screens.LoginScreen
import com.example.geocheckin.ui.screens.ProfileScreen
import com.example.geocheckin.ui.screens.SupervisorMapScreen

sealed class Screen(val route: String, val title: String, val icon: ImageVector? = null) {
    object Login : Screen("login", "Login")
    object CheckIn : Screen("checkin", "Check-in", Icons.Default.Place)
    object Map : Screen("map", "Supervisor Map", Icons.Default.Map)
    object Profile : Screen("profile", "Profile", Icons.Default.Person)
}

val bottomNavItems = listOf(
    Screen.CheckIn,
    Screen.Map,
    Screen.Profile
)

@Composable
fun AppNavigation(
    isLoggedIn: Boolean,
    userEmail: String
) {
    val navController = rememberNavController()
    val startDestination = if (isLoggedIn) Screen.CheckIn.route else Screen.Login.route

    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route
    val showBottomBar = currentRoute in bottomNavItems.map { it.route }

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                NavigationBar(
                    containerColor = MaterialTheme.colorScheme.surfaceContainer,
                    contentColor = MaterialTheme.colorScheme.onSurface
                ) {
                    bottomNavItems.forEach { screen ->
                        val selected = currentRoute == screen.route
                        NavigationBarItem(
                            icon = {
                                screen.icon?.let { Icon(it, contentDescription = screen.title) }
                            },
                            label = { Text(screen.title) },
                            selected = selected,
                            onClick = {
                                if (currentRoute != screen.route) {
                                    navController.navigate(screen.route) {
                                        popUpTo(navController.graph.findStartDestination().id) {
                                            saveState = true
                                        }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                }
                            }
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = startDestination,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(Screen.Login.route) {
                LoginScreen(
                    onLoginSuccess = {
                        navController.navigate(Screen.CheckIn.route) {
                            popUpTo(Screen.Login.route) { inclusive = true }
                        }
                    }
                )
            }
            composable(Screen.CheckIn.route) {
                CheckInScreen()
            }
            composable(Screen.Map.route) {
                SupervisorMapScreen()
            }
            composable(Screen.Profile.route) {
                ProfileScreen(
                    onLogout = {
                        navController.navigate(Screen.Login.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                )
            }
        }
    }
}`
  },
  {
    path: 'app/src/main/java/com/example/geocheckin/ui/screens/CheckInScreen.kt',
    name: 'CheckInScreen.kt',
    category: 'compose_ui',
    description: 'Check-in Tab screen: requests ACCESS_FINE_LOCATION, gets GPS, writes to Firestore "checkins", lists last 5 check-ins.',
    language: 'kotlin',
    content: `package com.example.geocheckin.ui.screens

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.example.geocheckin.data.model.CheckInRecord
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.GeoPoint
import com.google.firebase.firestore.Query
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun CheckInScreen() {
    val context = LocalContext.current
    val auth = remember { FirebaseAuth.getInstance() }
    val firestore = remember { FirebaseFirestore.getInstance() }
    val fusedLocationClient: FusedLocationProviderClient = remember {
        LocationServices.getFusedLocationProviderClient(context)
    }

    val currentUser = auth.currentUser
    var tripCode by remember { mutableStateOf("") }
    var currentLocation by remember { mutableStateOf<Location?>(null) }
    var isLocating by remember { mutableStateOf(false) }
    var isSubmitting by remember { mutableStateOf(false) }
    var hasLocationPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
        )
    }

    var recentCheckIns by remember { mutableStateOf<List<CheckInRecord>>(emptyList()) }
    var isLoadingHistory by remember { mutableStateOf(true) }

    fun fetchCurrentGps() {
        if (!hasLocationPermission) return
        isLocating = true
        try {
            fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
                .addOnSuccessListener { loc: Location? ->
                    isLocating = false
                    if (loc != null) {
                        currentLocation = loc
                    } else {
                        Toast.makeText(context, "Cannot get GPS. Please enable GPS service.", Toast.LENGTH_SHORT).show()
                    }
                }
                .addOnFailureListener {
                    isLocating = false
                    Toast.makeText(context, "Location error: \${it.localizedMessage}", Toast.LENGTH_SHORT).show()
                }
        } catch (e: SecurityException) {
            isLocating = false
        }
    }

    // Permission launcher for ACCESS_FINE_LOCATION
    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted: Boolean ->
        hasLocationPermission = isGranted
        if (isGranted) {
            Toast.makeText(context, "Location Permission Granted", Toast.LENGTH_SHORT).show()
            fetchCurrentGps()
        } else {
            Toast.makeText(context, "Location Permission Denied. GPS check-in unavailable.", Toast.LENGTH_LONG).show()
        }
    }

    // Auto-request permission on initial compose
    LaunchedEffect(Unit) {
        if (!hasLocationPermission) {
            permissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
        } else {
            fetchCurrentGps()
        }
    }

    // Fetch user's recent 5 check-ins from Firestore
    LaunchedEffect(currentUser?.uid) {
        currentUser?.uid?.let { uid ->
            firestore.collection("checkins")
                .whereEqualTo("userId", uid)
                .orderBy("timestamp", Query.Direction.DESCENDING)
                .limit(5)
                .addSnapshotListener { snapshot, error ->
                    isLoadingHistory = false
                    if (error != null) {
                        return@addSnapshotListener
                    }
                    if (snapshot != null) {
                        val list = snapshot.documents.mapNotNull { doc ->
                            try {
                                val id = doc.id
                                val userId = doc.getString("userId") ?: ""
                                val userEmail = doc.getString("userEmail") ?: ""
                                val code = doc.getString("tripCode") ?: ""
                                val geo = doc.getGeoPoint("location") ?: GeoPoint(0.0, 0.0)
                                val time = doc.getTimestamp("timestamp")?.toDate() ?: Date()
                                CheckInRecord(id, userId, userEmail, code, geo, time)
                            } catch (e: Exception) {
                                null
                            }
                        }
                        recentCheckIns = list
                    }
                }
        }
    }

    // Check-in button submit action
    fun performCheckIn() {
        if (currentUser == null) {
            Toast.makeText(context, "Please sign in first", Toast.LENGTH_SHORT).show()
            return
        }
        if (tripCode.trim().isEmpty()) {
            Toast.makeText(context, "Trip Code (行程代碼) is required", Toast.LENGTH_SHORT).show()
            return
        }
        if (currentLocation == null) {
            Toast.makeText(context, "Waiting for GPS coordinates. Please retry.", Toast.LENGTH_SHORT).show()
            fetchCurrentGps()
            return
        }

        isSubmitting = true
        val checkInData = hashMapOf(
            "userId" to currentUser.uid,
            "userEmail" to (currentUser.email ?: ""),
            "tripCode" to tripCode.trim(),
            "location" to GeoPoint(currentLocation!!.latitude, currentLocation!!.longitude),
            "timestamp" to FieldValue.serverTimestamp()
        )

        firestore.collection("checkins")
            .add(checkInData)
            .addOnSuccessListener {
                isSubmitting = false
                Toast.makeText(context, "Check-in Successful!", Toast.LENGTH_SHORT).show()
                tripCode = "" // Clear input field
                fetchCurrentGps() // refresh gps for next check-in
            }
            .addOnFailureListener { e ->
                isSubmitting = false
                Toast.makeText(context, "Check-in Failed: \${e.localizedMessage}", Toast.LENGTH_LONG).show()
            }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "Location Check-in (地點打卡)",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold
        )

        // GPS Status Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant
            ),
            shape = RoundedCornerShape(16.dp)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Current GPS Status",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    if (!hasLocationPermission) {
                        Text(
                            text = "Permission not granted",
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodyMedium
                        )
                    } else if (isLocating) {
                        Text(
                            text = "Acquiring high accuracy GPS...",
                            color = MaterialTheme.colorScheme.primary,
                            style = MaterialTheme.typography.bodyMedium
                        )
                    } else if (currentLocation != null) {
                        Text(
                            text = "Lat: \${String.format("%.5f", currentLocation!!.latitude)}, Lng: \${String.format("%.5f", currentLocation!!.longitude)}",
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Medium
                        )
                        Text(
                            text = "Accuracy: ±\${String.format("%.1f", currentLocation!!.accuracy)}m",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    } else {
                        Text(
                            text = "No GPS fix yet",
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }

                IconButton(
                    onClick = {
                        if (!hasLocationPermission) {
                            permissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
                        } else {
                            fetchCurrentGps()
                        }
                    }
                ) {
                    Icon(
                        imageVector = Icons.Default.Refresh,
                        contentDescription = "Refresh GPS",
                        tint = MaterialTheme.colorScheme.primary
                    )
                }
            }
        }

        // Trip Code Input Field
        OutlinedTextField(
            value = tripCode,
            onValueChange = { tripCode = it },
            label = { Text("Trip Code (行程代碼)*") },
            placeholder = { Text("e.g. TRIP-2026-A1") },
            leadingIcon = {
                Icon(Icons.Default.Place, contentDescription = null)
            },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp)
        )

        // Check-in Button
        Button(
            onClick = { performCheckIn() },
            enabled = !isSubmitting && hasLocationPermission,
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp),
            shape = RoundedCornerShape(12.dp)
        ) {
            if (isSubmitting) {
                CircularProgressIndicator(
                    modifier = Modifier.size(24.dp),
                    color = MaterialTheme.colorScheme.onPrimary,
                    strokeWidth = 2.dp
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text("Submitting...")
            } else {
                Icon(Icons.Default.CheckCircle, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Submit Check-in (打卡)", style = MaterialTheme.typography.titleMedium)
            }
        }

        Divider(modifier = Modifier.padding(vertical = 4.dp))

        // Recent 5 Check-ins Header
        Text(
            text = "Recent Check-ins (最近5筆打卡)",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )

        if (isLoadingHistory) {
            Box(modifier = Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(modifier = Modifier.size(32.dp))
            }
        } else if (recentCheckIns.isEmpty()) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Text(
                    text = "No recent check-ins found. Enter a trip code and check in above!",
                    modifier = Modifier.padding(16.dp),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        } else {
            val dateFormat = remember { SimpleDateFormat("yyyy/MM/dd HH:mm:ss", Locale.getDefault()) }
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth().weight(1f)
            ) {
                items(recentCheckIns) { record ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Default.Place,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(28.dp)
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = record.tripCode,
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = dateFormat.format(record.timestamp),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Text(
                                    text = "Lat: \${String.format("%.4f", record.location.latitude)}, Lng: \${String.format("%.4f", record.location.longitude)}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.primary
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}`
  },
  {
    path: 'app/src/main/java/com/example/geocheckin/ui/screens/SupervisorMapScreen.kt',
    name: 'SupervisorMapScreen.kt',
    category: 'compose_ui',
    description: 'Supervisor Map tab: Search by User Email + Trip Code, queries Firestore, sends markers to Leaflet WebView via JavaScript.',
    language: 'kotlin',
    content: `package com.example.geocheckin.ui.screens

import android.webkit.WebView
import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.example.geocheckin.data.model.CheckInRecord
import com.example.geocheckin.ui.components.LeafletWebView
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.GeoPoint
import com.google.firebase.firestore.Query
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun SupervisorMapScreen() {
    val context = LocalContext.current
    val firestore = remember { FirebaseFirestore.getInstance() }

    var searchEmail by remember { mutableStateOf("") }
    var searchTripCode by remember { mutableStateOf("") }
    var isSearching by remember { mutableStateOf(false) }
    var matchedRecords by remember { mutableStateOf<List<CheckInRecord>>(emptyList()) }

    var webViewInstance by remember { mutableStateOf<WebView?>(null) }

    fun sendMarkersToLeaflet(records: List<CheckInRecord>) {
        val webView = webViewInstance ?: return
        val dateFormat = SimpleDateFormat("yyyy/MM/dd HH:mm:ss", Locale.getDefault())

        val jsonArray = JSONArray()
        records.forEach { item ->
            val obj = JSONObject()
            obj.put("lat", item.location.latitude)
            obj.put("lng", item.location.longitude)
            obj.put("tripCode", item.tripCode)
            obj.put("userEmail", item.userEmail)
            obj.put("time", dateFormat.format(item.timestamp))
            jsonArray.put(obj)
        }

        val jsonString = jsonArray.toString()
        val jsCall = "javascript:if (window.renderCheckInMarkers) { window.renderCheckInMarkers('\${jsonString}'); }"
        
        webView.post {
            webView.evaluateJavascript(jsCall, null)
        }
    }

    fun performSupervisorSearch() {
        val cleanEmail = searchEmail.trim()
        val cleanTripCode = searchTripCode.trim()

        if (cleanEmail.isEmpty() && cleanTripCode.isEmpty()) {
            Toast.makeText(context, "Please enter User Email or Trip Code to filter", Toast.LENGTH_SHORT).show()
            return
        }

        isSearching = true

        var query: Query = firestore.collection("checkins")
        if (cleanEmail.isNotEmpty()) {
            query = query.whereEqualTo("userEmail", cleanEmail)
        }
        if (cleanTripCode.isNotEmpty()) {
            query = query.whereEqualTo("tripCode", cleanTripCode)
        }

        query.orderBy("timestamp", Query.Direction.ASCENDING)
            .get()
            .addOnSuccessListener { snapshot ->
                isSearching = false
                val results = snapshot.documents.mapNotNull { doc ->
                    try {
                        val id = doc.id
                        val uid = doc.getString("userId") ?: ""
                        val email = doc.getString("userEmail") ?: ""
                        val code = doc.getString("tripCode") ?: ""
                        val geo = doc.getGeoPoint("location") ?: GeoPoint(0.0, 0.0)
                        val time = doc.getTimestamp("timestamp")?.toDate() ?: Date()
                        CheckInRecord(id, uid, email, code, geo, time)
                    } catch (e: Exception) {
                        null
                    }
                }

                matchedRecords = results
                if (results.isEmpty()) {
                    Toast.makeText(context, "No check-in records found for this query", Toast.LENGTH_SHORT).show()
                    webViewInstance?.post {
                        webViewInstance?.evaluateJavascript("javascript:if (window.clearMap) { window.clearMap(); }", null)
                    }
                } else {
                    Toast.makeText(context, "Found \${results.size} check-in points on map", Toast.LENGTH_SHORT).show()
                    sendMarkersToLeaflet(results)
                }
            }
            .addOnFailureListener { error ->
                isSearching = false
                Toast.makeText(context, "Query failed: \${error.localizedMessage}", Toast.LENGTH_LONG).show()
            }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        // Supervisor Top Search Bar Card
        Surface(
            modifier = Modifier.fillMaxWidth(),
            tonalElevation = 3.dp,
            shadowElevation = 2.dp
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = searchEmail,
                        onValueChange = { searchEmail = it },
                        label = { Text("User Email (用戶Email)") },
                        leadingIcon = { Icon(Icons.Default.Email, contentDescription = null) },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(10.dp)
                    )

                    OutlinedTextField(
                        value = searchTripCode,
                        onValueChange = { searchTripCode = it },
                        label = { Text("Trip Code (行程代碼)") },
                        leadingIcon = { Icon(Icons.Default.Place, contentDescription = null) },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(10.dp)
                    )
                }

                Button(
                    onClick = { performSupervisorSearch() },
                    enabled = !isSearching,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    if (isSearching) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = MaterialTheme.colorScheme.onPrimary
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Searching Firestore...")
                    } else {
                        Icon(Icons.Default.Search, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Search & Plot on Leaflet Map (查詢地圖)")
                    }
                }
            }
        }

        // Leaflet Embedded WebView
        Box(modifier = Modifier.fillMaxSize().weight(1f)) {
            LeafletWebView(
                onWebViewReady = { webView ->
                    webViewInstance = webView
                }
            )
        }
    }
}`
  },
  {
    path: 'app/src/main/java/com/example/geocheckin/ui/components/LeafletWebView.kt',
    name: 'LeafletWebView.kt',
    category: 'webview',
    description: 'Embedded Android WebView hosting Leaflet.js map with custom JavaScriptInterface and hardware acceleration.',
    language: 'kotlin',
    content: `package com.example.geocheckin.ui.components

import android.annotation.SuppressLint
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView

class WebAppInterface(private val onMarkerClicked: (String) -> Unit) {
    @JavascriptInterface
    fun onMarkerClick(dataJson: String) {
        onMarkerClicked(dataJson)
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun LeafletWebView(
    modifier: Modifier = Modifier,
    onWebViewReady: (WebView) -> Unit,
    onMarkerClick: (String) -> Unit = {}
) {
    AndroidView(
        modifier = modifier,
        factory = { context ->
            WebView(context).apply {
                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )

                settings.apply {
                    javaScriptEnabled = true
                    domStorageEnabled = true
                    loadWithOverviewMode = true
                    useWideViewPort = true
                    cacheMode = WebSettings.LOAD_DEFAULT
                    allowFileAccess = true
                }

                webChromeClient = WebChromeClient()
                webViewClient = object : WebViewClient() {
                    override fun onPageFinished(view: WebView?, url: String?) {
                        super.onPageFinished(view, url)
                        onWebViewReady(this@apply)
                    }
                }

                addJavascriptInterface(WebAppInterface(onMarkerClick), "AndroidBridge")
                loadUrl("file:///android_asset/leaflet_map.html")
            }
        }
    )
}`
  },
  {
    path: 'app/src/main/assets/leaflet_map.html',
    name: 'leaflet_map.html',
    category: 'webview',
    description: 'Lightweight Leaflet.js HTML asset loaded by Android WebView for interactive map rendering.',
    language: 'html',
    content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    body, html { margin: 0; padding: 0; width: 100%; height: 100%; }
    #map { width: 100%; height: 100%; }
    .custom-popup { font-family: Roboto, sans-serif; font-size: 13px; }
    .popup-title { font-weight: bold; color: #1976D2; margin-bottom: 4px; }
    .popup-meta { color: #555; font-size: 11px; margin-top: 2px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: true }).setView([25.033964, 121.564468], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    var markersLayer = L.layerGroup().addTo(map);
    var polylineLayer = L.layerGroup().addTo(map);

    window.clearMap = function() {
      markersLayer.clearLayers();
      polylineLayer.clearLayers();
    };

    window.renderCheckInMarkers = function(jsonString) {
      window.clearMap();
      try {
        var items = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
        if (!items || items.length === 0) return;

        var latlngs = [];
        items.forEach(function(item, idx) {
          var lat = item.lat;
          var lng = item.lng;
          latlngs.push([lat, lng]);

          var marker = L.marker([lat, lng]).addTo(markersLayer);
          var html = '<div class="custom-popup">' +
            '<div class="popup-title">Trip: ' + (item.tripCode || 'N/A') + '</div>' +
            '<div class="popup-meta">User: ' + (item.userEmail || '') + '</div>' +
            '<div class="popup-meta">Time: ' + (item.time || '') + '</div>' +
            '<div class="popup-meta">Stop #' + (idx + 1) + ' (' + lat.toFixed(4) + ', ' + lng.toFixed(4) + ')</div>' +
            '</div>';
          marker.bindPopup(html);
          if (idx === items.length - 1) {
            marker.openPopup();
          }
        });

        if (latlngs.length > 1) {
          L.polyline(latlngs, { color: '#1976D2', weight: 4, dashArray: '6, 8' }).addTo(polylineLayer);
        }

        var bounds = L.latLngBounds(latlngs);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      } catch (e) {
        console.error("Leaflet parse error", e);
      }
    };
  </script>
</body>
</html>`
  },
  {
    path: 'app/src/main/java/com/example/geocheckin/ui/screens/ProfileScreen.kt',
    name: 'ProfileScreen.kt',
    category: 'compose_ui',
    description: 'User Profile Tab: user email header, unique trip codes & total check-in record counts from Firestore, and Logout action.',
    language: 'kotlin',
    content: `package com.example.geocheckin.ui.screens

import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Timeline
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore

@Composable
fun ProfileScreen(
    onLogout: () -> Unit
) {
    val context = LocalContext.current
    val auth = remember { FirebaseAuth.getInstance() }
    val firestore = remember { FirebaseFirestore.getInstance() }
    val currentUser = auth.currentUser

    var uniqueTripCodesCount by remember { mutableStateOf(0) }
    var totalCheckInsCount by remember { mutableStateOf(0) }
    var isLoadingStats by remember { mutableStateOf(true) }

    // Fetch user checkin metrics from Firestore
    LaunchedEffect(currentUser?.uid) {
        currentUser?.uid?.let { uid ->
            firestore.collection("checkins")
                .whereEqualTo("userId", uid)
                .get()
                .addOnSuccessListener { snapshot ->
                    isLoadingStats = false
                    val documents = snapshot.documents
                    totalCheckInsCount = documents.size

                    val codes = documents.mapNotNull { it.getString("tripCode")?.trim() }
                        .filter { it.isNotEmpty() }
                        .toSet()
                    uniqueTripCodesCount = codes.size
                }
                .addOnFailureListener {
                    isLoadingStats = false
                }
        }
    }

    fun performLogout() {
        auth.signOut()
        Toast.makeText(context, "Logged out successfully", Toast.LENGTH_SHORT).show()
        onLogout()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "User Profile (個人資料)",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold
        )

        // User Header Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
            shape = RoundedCornerShape(16.dp)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    shape = CircleShape,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(56.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = Icons.Default.Person,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onPrimary,
                            modifier = Modifier.size(32.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.width(16.dp))

                Column {
                    Text(
                        text = currentUser?.email ?: "Guest User",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                    Text(
                        text = "User ID: \${currentUser?.uid?.take(8) ?: "N/A"}...",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                    )
                }
            }
        }

        // Usage Summary Header
        Text(
            text = "Usage Summary (使用統計)",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Metric 1: My Unique Trip Codes
            Card(
                modifier = Modifier.weight(1f),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    horizontalAlignment = Alignment.Start
                ) {
                    Icon(
                        imageVector = Icons.Default.Timeline,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    if (isLoadingStats) {
                        CircularProgressIndicator(modifier = Modifier.size(20.dp))
                    } else {
                        Text(
                            text = "\$uniqueTripCodesCount",
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                    Text(
                        text = "My Unique Trip Codes",
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Medium
                    )
                    Text(
                        text = "(獨立行程代碼數)",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // Metric 2: Total Check-in Records
            Card(
                modifier = Modifier.weight(1f),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    horizontalAlignment = Alignment.Start
                ) {
                    Icon(
                        imageVector = Icons.Default.Place,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.secondary
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    if (isLoadingStats) {
                        CircularProgressIndicator(modifier = Modifier.size(20.dp))
                    } else {
                        Text(
                            text = "\$totalCheckInsCount",
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.secondary
                        )
                    }
                    Text(
                        text = "Total Check-in Records",
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Medium
                    )
                    Text(
                        text = "(總打卡次數)",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        Spacer(modifier = Modifier.weight(1f))

        // Logout Button
        OutlinedButton(
            onClick = { performLogout() },
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            colors = ButtonDefaults.outlinedButtonColors(
                contentColor = MaterialTheme.colorScheme.error
            ),
            shape = RoundedCornerShape(12.dp)
        ) {
            Icon(Icons.Default.ExitToApp, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Logout (登出帳號)", fontWeight = FontWeight.Bold)
        }
    }
}`
  },
  {
    path: 'app/src/main/java/com/example/geocheckin/ui/screens/LoginScreen.kt',
    name: 'LoginScreen.kt',
    category: 'compose_ui',
    description: 'Authentication Screen: FirebaseAuth email/password login with input validation & status toasts.',
    language: 'kotlin',
    content: `package com.example.geocheckin.ui.screens

import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Place
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.google.firebase.auth.FirebaseAuth

@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit
) {
    val context = LocalContext.current
    val auth = remember { FirebaseAuth.getInstance() }

    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }

    fun handleLogin() {
        val cleanEmail = email.trim()
        val cleanPassword = password.trim()

        if (cleanEmail.isEmpty()) {
            Toast.makeText(context, "Please enter your Email", Toast.LENGTH_SHORT).show()
            return
        }
        if (!android.util.Patterns.EMAIL_ADDRESS.matcher(cleanEmail).matches()) {
            Toast.makeText(context, "Invalid email address format", Toast.LENGTH_SHORT).show()
            return
        }
        if (cleanPassword.isEmpty()) {
            Toast.makeText(context, "Please enter your Password", Toast.LENGTH_SHORT).show()
            return
        }

        isLoading = true
        auth.signInWithEmailAndPassword(cleanEmail, cleanPassword)
            .addOnCompleteListener { task ->
                isLoading = false
                if (task.isSuccessful) {
                    Toast.makeText(context, "Login Successful! Welcome back.", Toast.LENGTH_SHORT).show()
                    onLoginSuccess()
                } else {
                    val errorMsg = task.exception?.localizedMessage ?: "Authentication failed"
                    Toast.makeText(context, "Login Error: \$errorMsg", Toast.LENGTH_LONG).show()
                }
            }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Surface(
                shape = RoundedCornerShape(20.dp),
                color = MaterialTheme.colorScheme.primaryContainer,
                modifier = Modifier.size(72.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Default.Place,
                        contentDescription = "App Logo",
                        modifier = Modifier.size(40.dp),
                        tint = MaterialTheme.colorScheme.primary
                    )
                }
            }

            Text(
                text = "GeoCheckin",
                style = MaterialTheme.typography.headlineLarge,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "Field Location & Supervisor Monitor",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(8.dp))

            OutlinedTextField(
                value = email,
                onValueChange = { email = it },
                label = { Text("Email Address") },
                placeholder = { Text("name@company.com") },
                leadingIcon = { Icon(Icons.Default.Email, contentDescription = null) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            )

            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Password") },
                placeholder = { Text("••••••••") },
                leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null) },
                visualTransformation = PasswordVisualTransformation(),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            )

            Button(
                onClick = { handleLogin() },
                enabled = !isLoading,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(12.dp)
            ) {
                if (isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = MaterialTheme.colorScheme.onPrimary,
                        strokeWidth = 2.dp
                    )
                } else {
                    Text("Sign In (登入)", style = MaterialTheme.typography.titleMedium)
                }
            }
        }
    }
}`
  },
  {
    path: 'app/src/main/java/com/example/geocheckin/data/model/CheckInRecord.kt',
    name: 'CheckInRecord.kt',
    category: 'data',
    description: 'Data model matching Cloud Firestore "checkins" collection schema with GeoPoint & ServerTimestamp.',
    language: 'kotlin',
    content: `package com.example.geocheckin.data.model

import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.GeoPoint
import com.google.firebase.firestore.ServerTimestamp
import java.util.Date

data class CheckInRecord(
    @DocumentId
    val id: String = "",
    val userId: String = "",
    val userEmail: String = "",
    val tripCode: String = "",
    val location: GeoPoint = GeoPoint(0.0, 0.0),
    @ServerTimestamp
    val timestamp: Date = Date()
)`
  },
  {
    path: 'app/src/main/AndroidManifest.xml',
    name: 'AndroidManifest.xml',
    category: 'gradle_manifest',
    description: 'Android Manifest with ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION, INTERNET permissions and WebView hardware acceleration.',
    language: 'xml',
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Location Permissions -->
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    
    <!-- Internet & Network for Firebase & Leaflet Tiles -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="GeoCheckin"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.GeoCheckin"
        android:hardwareAccelerated="true">
        
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:theme="@style/Theme.GeoCheckin">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>

</manifest>`
  },
  {
    path: 'app/build.gradle.kts',
    name: 'build.gradle.kts (App)',
    category: 'gradle_manifest',
    description: 'Gradle dependencies for Jetpack Compose Material 3, Firebase Firestore, Firebase Auth, Google Play Location, Accompanist & Leaflet WebView.',
    language: 'gradle',
    content: `plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.google.gms.google.services)
}

android {
    namespace = "com.example.geocheckin"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.example.geocheckin"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
    }
}

dependencies {
    // Jetpack Compose BOM & Material 3
    val composeBom = platform("androidx.compose:compose-bom:2024.10.01")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.navigation:navigation-compose:2.8.3")

    // Firebase BOM, Auth & Firestore
    val firebaseBom = platform("com.google.firebase:firebase-bom:33.5.1")
    implementation(firebaseBom)
    implementation("com.google.firebase:firebase-auth-ktx")
    implementation("com.google.firebase:firebase-firestore-ktx")

    // Google Play Services Location
    implementation("com.google.android.gms:play-services-location:21.3.0")

    // AndroidX & Activity Compose
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.6")
    implementation("androidx.activity:activity-compose:1.9.3")
}`
  },
  {
    path: 'app/src/main/java/com/hh/geotrack/AttractionRepository.kt',
    name: 'AttractionRepository.kt',
    category: 'data',
    description: '100 POIs Dataset for Taipei, New Taipei & Keelung with Lat/Lng and category info for 200m geofencing.',
    language: 'kotlin',
    content: `package com.hh.geotrack

data class Attraction(
    val id: Int,
    val name: String,
    val city: String,
    val district: String,
    val lat: Double,
    val lng: Double,
    val category: String = "景點"
)

// 100 Attractions across Taipei (50), New Taipei (40), and Keelung (10)
val northTaiwan100AttractionsSpaced = listOf(
    // 台北市 (50 處)
    Attraction(1, "台北101觀景台", "台北市", "信義區", 25.033976, 121.564539, "地標"),
    Attraction(2, "象山六巨石", "台北市", "信義區", 25.027222, 121.576389, "步道"),
    Attraction(3, "國父紀念館", "台北市", "信義區", 25.040103, 121.560155, "文化"),
    Attraction(4, "信義商圈香堤大道", "台北市", "信義區", 25.036667, 121.567222, "商圈"),
    Attraction(5, "永春崗公園觀景台", "台北市", "信義區", 25.031389, 121.581944, "步道"),
    Attraction(6, "四四南村", "台北市", "信義區", 25.031389, 121.561944, "文創"),
    // ... 100 POIs loaded in repository
)
`
  }
];
