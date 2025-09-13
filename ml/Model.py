import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset
import matplotlib.pyplot as plt
import argparse
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score, accuracy_score, f1_score

# Robust import of data module whether run as package (python -m ml.Model) or script (python ml/Model.py)
try:
    from . import data as data_mod  # type: ignore
except ImportError:  # pragma: no cover
    import os, sys
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir)
    if parent_dir not in sys.path:
        sys.path.append(parent_dir)
    import ml.data as data_mod  # type: ignore


device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

class GradePredictor(nn.Module):
    def __init__(self, input_dim, num_classes: int | None = None):
        super().__init__()
        hidden1 = 64
        hidden2 = 32
        if num_classes is None:
            # regression
            self.net = nn.Sequential(
                nn.Linear(input_dim, hidden1),
                nn.ReLU(),
                nn.Linear(hidden1, hidden2),
                nn.ReLU(),
                nn.Linear(hidden2, 1),
            )
            self.is_classification = False
        else:
            self.net = nn.Sequential(
                nn.Linear(input_dim, hidden1),
                nn.ReLU(),
                nn.Linear(hidden1, hidden2),
                nn.ReLU(),
                nn.Linear(hidden2, num_classes),
            )
            self.is_classification = True
            self.num_classes = num_classes
    def forward(self, x):
        return self.net(x)
    
def train_model(model, train_loader, val_loader, epochs=50, lr=0.001, device='cpu', classification=False):
    if classification:
        criterion = nn.CrossEntropyLoss()
    else:
        criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=lr)
    model.to(device)
    train_losses, val_losses = [], []
    model.to(device)
    for epoch in range(epochs):
        model.train()
        running_loss = 0.0
        for inputs, targets in train_loader:
            inputs = inputs.to(device)
            targets = targets.to(device)
            optimizer.zero_grad()
            outputs = model(inputs)
            if classification:
                loss = criterion(outputs, targets.long())
            else:
                loss = criterion(outputs.squeeze(), targets)
            loss.backward()
            optimizer.step()
            running_loss += loss.item() * inputs.size(0)
        epoch_loss = running_loss / len(train_loader.dataset)
        train_losses.append(epoch_loss)
        
        model.eval()
        val_running_loss = 0.0
        with torch.no_grad():
            for inputs, targets in val_loader:
                inputs = inputs.to(device)
                targets = targets.to(device)
                outputs = model(inputs)
                if classification:
                    loss = criterion(outputs, targets.long())
                else:
                    loss = criterion(outputs.squeeze(), targets)
                val_running_loss += loss.item() * inputs.size(0)
        val_epoch_loss = val_running_loss / len(val_loader.dataset)
        val_losses.append(val_epoch_loss)
        
        print(f'Epoch {epoch+1}/{epochs}, Train Loss: {epoch_loss:.4f}, Val Loss: {val_epoch_loss:.4f}')
    
    return train_losses, val_losses

def evaluate_model(model, X, y, device='cpu', classification=False):
    model.eval()
    with torch.no_grad():
        inputs = torch.tensor(X.values, dtype=torch.float32).to(device)
        outputs = model(inputs)
        if classification:
            probs = torch.softmax(outputs, dim=1)
            preds = probs.argmax(dim=1).cpu().numpy()
            y_np = y.values if hasattr(y, 'values') else y
            acc = accuracy_score(y_np, preds)
            f1m = f1_score(y_np, preds, average='macro')
            return {'accuracy': acc, 'f1_macro': f1m}, preds, probs.cpu().numpy()
        else:
            preds = outputs.squeeze().cpu().numpy()
            mae = mean_absolute_error(y, preds)
            r2 = r2_score(y, preds)
            return {'mae': mae, 'r2': r2}, preds, None

def plot_losses(train_losses, val_losses):
    plt.plot(train_losses, label='Train Loss')
    plt.plot(val_losses, label='Val Loss')
    plt.xlabel('Epoch')
    plt.ylabel('Loss')
    plt.legend()
    plt.show()

def build_dataloader(X, y, batch_size=32, shuffle=True, classification=False):
    class StudentDataset(Dataset):
        def __init__(self, X, y):
            self.X = torch.tensor(X.values, dtype=torch.float32)
            if classification:
                # Expect integer class labels 0..K-1
                self.y = torch.tensor(y.values, dtype=torch.long)
            else:
                self.y = torch.tensor(y.values, dtype=torch.float32)
        def __len__(self):
            return len(self.y)
        def __getitem__(self, idx):
            return self.X[idx], self.y[idx]
    
    dataset = StudentDataset(X, y)
    return DataLoader(dataset, batch_size=batch_size, shuffle=shuffle)


def main():
    parser = argparse.ArgumentParser(description="Train grade prediction MLP")
    parser.add_argument('--limit', type=int, default=0)
    parser.add_argument('--extended', action='store_true')
    parser.add_argument('--super-minimal', action='store_true')
    parser.add_argument('--add-difficulty', action='store_true')
    parser.add_argument('--difficulty-group', type=str, default='school')
    parser.add_argument('--dfw-threshold-percent', type=float, default=50.0)
    parser.add_argument('--scale-grades', action='store_true')
    parser.add_argument('--keep-g1-g2', action='store_true')
    parser.add_argument('--test-size', type=float, default=0.2)
    parser.add_argument('--epochs', type=int, default=40)
    parser.add_argument('--lr', type=float, default=1e-3)
    parser.add_argument('--batch-size', type=int, default=32)
    parser.add_argument('--device', type=str, default='auto', help="cpu|cuda|auto")
    parser.add_argument('--save-path', type=str, default='', help='If set, save trained model to this .pt file')
    parser.add_argument('--ten-class', action='store_true', help='If set, treat target as 10 ordinal classes (G3 bins).')
    args = parser.parse_args()

    raw = data_mod.fetch_raw(args.limit)
    X, y = data_mod.build_features(
        raw,
        extended=args.extended,
        scale_grades=args.scale_grades,
        super_minimal=args.super_minimal,
        keep_g1_g2=args.keep_g1_g2,
        add_difficulty=args.add_difficulty,
        difficulty_group=args.difficulty_group,
        dfw_threshold_percent=args.dfw_threshold_percent,
        ten_class=args.ten_class
    )

    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=args.test_size, random_state=42)
    train_loader = build_dataloader(X_train, y_train, batch_size=args.batch_size, shuffle=True, classification=args.ten_class)
    val_loader = build_dataloader(X_val, y_val, batch_size=args.batch_size, shuffle=False, classification=args.ten_class)

    if args.device == 'auto':
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
    else:
        device = args.device
    print(f"Using device: {device}")
    model = GradePredictor(input_dim=X_train.shape[1], num_classes=10 if args.ten_class else None)
    train_losses, val_losses = train_model(model, train_loader, val_loader, epochs=args.epochs, lr=args.lr, device=device, classification=args.ten_class)

    metrics, preds, probs = evaluate_model(model, X_val, y_val, device=device, classification=args.ten_class)
    if args.ten_class:
        print(f"Validation Accuracy: {metrics['accuracy']:.3f} | F1_macro: {metrics['f1_macro']:.3f}")
    else:
        print(f"Validation MAE: {metrics['mae']:.3f} | R2: {metrics['r2']:.3f}")

    if args.save_path:
        save_obj = {
            'model_state': model.state_dict(),
            'input_dim': X_train.shape[1],
            'args': vars(args),
            'classification': args.ten_class,
            'metrics': metrics
        }
        torch.save(save_obj, args.save_path)
        print(f"Saved model to {args.save_path}")
    try:
        plot_losses(train_losses, val_losses)
    except Exception:
        pass

if __name__ == '__main__':
    main()

def load_model(path: str) -> GradePredictor:
    ckpt = torch.load(path, map_location='cpu')
    model = GradePredictor(input_dim=ckpt['input_dim'], num_classes=10 if ckpt.get('classification') else None)
    model.load_state_dict(ckpt['model_state'])
    model.eval()
    return model
