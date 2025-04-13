import torch.nn as nn
import torch
from torchvision import transforms
from transformers import AutoImageProcessor, AutoModelForImageClassification

class CoordAttention(nn.Module):
    """
    Coordinate Attention module, which enhances the attention mechanism by separately focusing on
    height and width dimensions, capturing long-range dependencies along one spatial direction at a time.

    Args:
        in_channels (int): Number of input channels.
        reduction (int): Reduction ratio for the intermediate channel size. Default is 32.
    """
    def __init__(self, in_channels, reduction=32):
        super(CoordAttention, self).__init__()
        self.pool_h = nn.AdaptiveAvgPool2d((1, None))  # Pooling across height, keeping width unchanged
        self.pool_w = nn.AdaptiveAvgPool2d((None, 1))  # Pooling across width, keeping height unchanged

        # Calculate the number of intermediate channels
        mid_channels = max(8, in_channels // reduction)

        # Convolution to reduce the number of channels
        self.conv1 = nn.Conv2d(in_channels, mid_channels, kernel_size=1, stride=1, padding=0, bias=False)
        self.bn1 = nn.BatchNorm2d(mid_channels)  # Batch normalization
        self.act = nn.ReLU(inplace=True)  # ReLU activation

        # Convolutions to restore the number of channels
        self.conv_h = nn.Conv2d(mid_channels, in_channels, kernel_size=1, stride=1, padding=0, bias=False)
        self.conv_w = nn.Conv2d(mid_channels, in_channels, kernel_size=1, stride=1, padding=0, bias=False)

    def forward(self, x):
        """
        Forward pass through the Coordinate Attention module.

        Args:
            x (torch.Tensor): Input tensor of shape (batch_size, in_channels, height, width).

        Returns:
            torch.Tensor: Output tensor with enhanced attention, of the same shape as the input.
        """
        identity = x  # Save the input tensor for later
        n, c, h, w = x.size()  # Get the dimensions of the input tensor

        # Apply coordinate attention along the height and width dimensions
        x_h = self.pool_h(x)  # Global average pooling along height, result shape: [N, C, 1, W]
        x_w = self.pool_w(x).permute(0, 1, 3, 2)  # Global average pooling along width, result shape: [N, C, W, 1]

        # Apply convolution and batch normalization
        y_h = self.conv1(x_h)  # Convolution on pooled height dimension, result shape: [N, C', 1, W]
        y_w = self.conv1(x_w)  # Convolution on pooled width dimension, result shape: [N, C', W, 1]

        y_h = self.bn1(y_h)  # Apply batch normalization to height
        y_w = self.bn1(y_w)  # Apply batch normalization to width
        y_h = self.act(y_h)  # Apply ReLU activation to height
        y_w = self.act(y_w)  # Apply ReLU activation to width

        # Restore the number of channels to the original input size
        out_h = self.conv_h(y_h)  # Convolution on height result, restoring channels, shape: [N, C, 1, W]
        out_w = self.conv_w(y_w).permute(0, 1, 3, 2)  # Convolution on width result, restoring channels, shape: [N, C, H, 1]

        # Combine the height and width attention maps and apply them to the original input
        out = identity * torch.sigmoid(out_h + out_w)  # Sigmoid activation and element-wise multiplication with input

        return out  # Return the output tensor with coordinate attention applied

class DoubleConvCA(nn.Module):
    """
    A module consisting of two consecutive convolutional layers, each followed by batch normalization
    and a ReLU activation, with an added Coordinate Attention (CA) block.

    (Convolution => [BN] => ReLU) * 2 with Coordinate Attention

    Args:
        in_channels (int): Number of input channels.
        out_channels (int): Number of output channels.
    """
    def __init__(self, in_channels, out_channels):
        super(DoubleConvCA, self).__init__()
        self.double_conv = nn.Sequential(
            nn.Conv2d(in_channels, out_channels, kernel_size=3, padding=1),  # 1st Convolutional layer
            nn.BatchNorm2d(out_channels),  # Batch normalization
            nn.ReLU(inplace=True),  # ReLU activation
            nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1),  # 2nd Convolutional layer
            nn.BatchNorm2d(out_channels),  # Batch normalization
            nn.ReLU(inplace=True)  # ReLU activation
        )
        self.coord_attention = CoordAttention(out_channels)  # Coordinate Attention block

    def forward(self, x):
        """
        Forward pass through the DoubleConvCA block.

        Args:
            x (torch.Tensor): Input tensor of shape (batch_size, in_channels, height, width).

        Returns:
            torch.Tensor: Output tensor after applying two convolutional layers,
                          batch normalization, ReLU activations, and the Coordinate Attention block.
        """
        x = self.double_conv(x)  # Apply the double convolution
        x = self.coord_attention(x)  # Apply the Coordinate Attention block
        return x


class UNetCoordAttention(nn.Module):
    """
    A modified UNet architecture with Coordinate Attention (CA) blocks integrated
    into each double convolution block.

    Args:
        n_channels (int): Number of input channels (e.g., 3 for RGB images).
        n_classes (int): Number of output channels (number of segmentation classes).
    """
    def __init__(self, n_channels, n_classes):
        super(UNetCoordAttention, self).__init__()
        self.inc = DoubleConvCA(n_channels, 64)  # Initial convolutional block with CA
        self.down1 = nn.Sequential(nn.MaxPool2d(2), DoubleConvCA(64, 128))  # Downsample and convolve with CA
        self.down2 = nn.Sequential(nn.MaxPool2d(2), DoubleConvCA(128, 256))  # Downsample and convolve with CA
        self.down3 = nn.Sequential(nn.MaxPool2d(2), DoubleConvCA(256, 512))  # Downsample and convolve with CA
        self.down4 = nn.Sequential(nn.MaxPool2d(2), DoubleConvCA(512, 1024))  # Downsample and convolve with CA
        self.up1 = nn.ConvTranspose2d(1024, 512, kernel_size=2, stride=2)  # Upsample
        self.up_conv1 = DoubleConvCA(1024, 512)  # Convolutional block with CA after upsampling
        self.up2 = nn.ConvTranspose2d(512, 256, kernel_size=2, stride=2)  # Upsample
        self.up_conv2 = DoubleConvCA(512, 256)  # Convolutional block with CA after upsampling
        self.up3 = nn.ConvTranspose2d(256, 128, kernel_size=2, stride=2)  # Upsample
        self.up_conv3 = DoubleConvCA(256, 128)  # Convolutional block with CA after upsampling
        self.up4 = nn.ConvTranspose2d(128, 64, kernel_size=2, stride=2)  # Upsample
        self.up_conv4 = DoubleConvCA(128, 64)  # Convolutional block with CA after upsampling
        self.outc = nn.Conv2d(64, n_classes, kernel_size=1)  # Final output layer

    def forward(self, x):
        """
        Forward pass through the UNetCoordAttention model.

        Args:
            x (torch.Tensor): Input tensor of shape (batch_size, n_channels, height, width).

        Returns:
            torch.Tensor: Output tensor of shape (batch_size, n_classes, height, width).
        """
        # Encoder path
        x1 = self.inc(x)  # Initial convolution with CA
        x2 = self.down1(x1)  # Downsample and convolve with CA
        x3 = self.down2(x2)  # Downsample and convolve with CA
        x4 = self.down3(x3)  # Downsample and convolve with CA
        x5 = self.down4(x4)  # Downsample and convolve with CA

        # Decoder path
        x = self.up1(x5)  # Upsample
        x = torch.cat([x4, x], dim=1)  # Concatenate with corresponding feature map from encoder
        x = self.up_conv1(x)  # Apply convolutional block with CA after upsampling

        x = self.up2(x)  # Upsample
        x = torch.cat([x3, x], dim=1)  # Concatenate with corresponding feature map from encoder
        x = self.up_conv2(x)  # Apply convolutional block with CA after upsampling

        x = self.up3(x)  # Upsample
        x = torch.cat([x2, x], dim=1)  # Concatenate with corresponding feature map from encoder
        x = self.up_conv3(x)  # Apply convolutional block with CA after upsampling

        x = self.up4(x)  # Upsample
        x = torch.cat([x1, x], dim=1)  # Concatenate with corresponding feature map from encoder
        x = self.up_conv4(x)  # Apply convolutional block with CA after upsampling

        logits = self.outc(x)  # Final output layer
        return logits  # Return the logits for the segmentation map


device = torch.device("cpu")  # or "cuda" if available

# Load model
model = UNetCoordAttention(n_channels=3, n_classes=1)
model.load_state_dict(torch.load("model_ca.pth", map_location=device))
model.eval()

# --- Transform ---
transform = transforms.Compose([
    transforms.Resize((256, 256)),  # Resize the images and masks to 256x256 pixels
    transforms.ToTensor()  # Convert the images and masks to PyTorch tensors
])

# Load model
model_name = "ShimaGh/Brain-Tumor-Detection"
processor = AutoImageProcessor.from_pretrained(model_name)
model_br = AutoModelForImageClassification.from_pretrained(model_name)
model_br.eval()